from __future__ import annotations

import asyncio
import logging
from typing import Any

from config.manager import ConfigManager
from domain.models import PanelColor, RenderPlan
from domain.ports import BatterySourcePort, LightingOutputPort
from lighting.fingerprint import compute_render_fingerprint
from lighting.service import LightingService

logger = logging.getLogger(__name__)


class MappingSetupCoordinator:
    """
    Coordinator for device and panel mapping wizard (Setup / Mapping Wizard).
    Manages runtime setup sessions, panel topology discovery, identify flash/cycles,
    temporary group previews, and atomic validated layout saving.

    Координатор первичной настройки маппинга устройств и панелей (Setup / Mapping Wizard).
    Управляет runtime-сессией настройки, обнаружением устройств и панелей,
    точечной и циклической идентификацией панелей, предварительным просмотром (preview)
    и валидированным атомарным сохранением раскладки.
    """

    def __init__(
        self,
        config: ConfigManager,
        lighting: LightingService,
        source: BatterySourcePort,
        output: LightingOutputPort,
    ) -> None:
        self.config = config
        self.lighting = lighting
        self.source = source
        self.output = output

        self._lock = asyncio.Lock()
        self._session_active: bool = False
        self._generation: int = 0
        self._preview_active: bool = False
        self._identifying_panel_id: int | None = None
        self._identify_task: asyncio.Task[None] | None = None
        self._cached_panel_ids: set[int] | None = None
        self._background_tasks: set[asyncio.Task[Any]] = set()

    # --- Discovery Operations / Операции обнаружения ---

    def get_discovered_devices(self) -> list[dict[str, Any]]:
        """
        Returns discovered G HUB devices enriched with mapping statuses.
        Возвращает список обнаруженных G HUB устройств, обогащённый статусом маппинга.
        """
        raw_devices = self.source.get_devices_snapshot()
        configured_mappings = self.config.get_config().mapping.devices

        result: list[dict[str, Any]] = []

        for dev_id, dev in raw_devices.items():
            name = str(dev.get("name", dev_id))
            device_type = str(dev.get("device_type", "UNKNOWN"))
            has_battery = bool(dev.get("has_battery", False))

            battery_obj = dev.get("battery")
            battery_dict: dict[str, Any] | None = None
            if battery_obj is not None:
                battery_dict = {
                    "percentage": getattr(battery_obj, "percentage", 0),
                    "charging": getattr(battery_obj, "charging", False),
                    "critical": getattr(battery_obj, "critical", False),
                    "fully_charged": getattr(battery_obj, "fully_charged", False),
                }

            # Check if mapped to any group in config / Проверка привязки к группе
            mapped_group = next(
                (g for g in configured_mappings if g.match.lower() in name.lower()),
                None,
            )

            result.append({
                "device_id": dev_id,
                "name": name,
                "device_type": device_type,
                "has_battery": has_battery,
                "battery": battery_dict,
                "is_mapped": mapped_group is not None,
                "mapped_match": mapped_group.match if mapped_group else None,
                "mapped_label": mapped_group.label if mapped_group else None,
                "mapped_base_color": mapped_group.base_color if mapped_group else None,
                "mapped_panel_ids": mapped_group.panel_ids if mapped_group else [],
            })

        # Sort mapped first, then by name
        result.sort(key=lambda d: (not d["has_battery"], d["name"]))
        return result

    async def get_discovered_panels(self) -> list[dict[str, Any]]:
        """
        Returns real Nanoleaf panel IDs with coordinates, shapes, assignment status, and conflicts.
        Возвращает список реальных ID панелей Nanoleaf с координатами, формой, статусом назначения и конфликтов.
        """
        geom_map: dict[int, dict[str, Any]] = {}
        try:
            geom_list = await asyncio.to_thread(self.output.get_layout_geometry)
            for geom in geom_list:
                geom_map[int(geom.get("panel_id", 0))] = geom
        except Exception:
            logger.exception("Failed to query panel layout geometry from Nanoleaf controller")

        configured_mappings = self.config.get_config().mapping.devices

        result: list[dict[str, Any]] = []

        all_panel_ids = set(geom_map.keys())
        for grp in configured_mappings:
            for pid in grp.panel_ids:
                if pid > 0:
                    all_panel_ids.add(pid)

        sorted_panel_ids = sorted(all_panel_ids)

        for i, pid in enumerate(sorted_panel_ids):
            assigned_groups = [
                grp for grp in configured_mappings if pid in grp.panel_ids
            ]

            is_assigned = len(assigned_groups) > 0
            has_conflict = len(assigned_groups) > 1

            geo = geom_map.get(pid, {})
            # Fallback coordinates if Nanoleaf is offline / Координаты по умолчанию при офлайн контроллере
            default_x = float(geo.get("x", (i % 6) * 120))
            default_y = float(geo.get("y", (i // 6) * 100))
            orientation = float(geo.get("orientation", 0.0))
            shape_type = int(geo.get("shape_type", 7))
            side_length = int(geo.get("side_length", 100))

            result.append({
                "panel_id": pid,
                "is_assigned": is_assigned,
                "assigned_group_match": assigned_groups[0].match if is_assigned else None,
                "assigned_group_label": assigned_groups[0].label if is_assigned else None,
                "has_conflict": has_conflict,
                "conflict_group_labels": [g.label for g in assigned_groups] if has_conflict else [],
                "x": default_x,
                "y": default_y,
                "orientation": orientation,
                "shape_type": shape_type,
                "side_length": side_length,
            })

        return result

    # --- Runtime Session State / Состояние сессии настройки ---

    def get_session_state(self) -> dict[str, Any]:
        return {
            "active": self._session_active,
            "preview_active": self._preview_active,
            "identifying_panel_id": self._identifying_panel_id,
            "cycle_running": self._identify_task is not None and not self._identify_task.done(),
            "generation": self._generation,
        }

    async def start_session(self) -> dict[str, Any]:
        async with self._lock:
            self._session_active = True
            self._generation += 1
            self._cancel_identify_task_locked()
            try:
                pids = set(await asyncio.to_thread(self.output.get_panel_ids))
            except Exception:
                pids = set()
            for g in self.config.get_config().mapping.devices:
                for pid in g.panel_ids:
                    if pid > 0:
                        pids.add(pid)
            self._cached_panel_ids = {p for p in pids if p > 0}
            return self.get_session_state()

    async def stop_session(self) -> None:
        async with self._lock:
            self._session_active = False
            self._preview_active = False
            self._identifying_panel_id = None
            self._generation += 1
            self._cancel_identify_task_locked()
            self._cached_panel_ids = None

        await self.restore_normal_render()

    # --- Panel Identification / Идентификация панелей ---

    async def identify_panel(
        self,
        panel_id: int,
        color: list[int] | tuple[int, int, int] = (255, 255, 255),
        duration_ms: int = 1500,
    ) -> None:
        """
        Visually flashes a single panel with color and restores active lighting.
        Точечно подсвечивает одну панель ярким цветом, затем восстанавливает обычный рендер.
        """
        async with self._lock:
            self._generation += 1
            current_gen = self._generation
            self._cancel_identify_task_locked()
            self._identifying_panel_id = panel_id
            self._preview_active = False

            # Build static plan for this panel
            known_panels = await self._get_all_known_panel_ids_async()
            plan = self._build_single_panel_plan(panel_id, color, known_panels)
            await asyncio.to_thread(self.output.apply_render_plan, plan)

        # Schedule automatic restore after duration
        restore_task = asyncio.create_task(self._delayed_restore(current_gen, duration_ms))
        self._background_tasks.add(restore_task)
        restore_task.add_done_callback(self._background_tasks.discard)

    async def _delayed_restore(self, gen: int, duration_ms: int) -> None:
        await asyncio.sleep(max(100, duration_ms) / 1000.0)
        async with self._lock:
            if self._generation != gen:
                return
            self._identifying_panel_id = None

        await self.restore_normal_render()

    async def start_identify_cycle(
        self,
        panel_ids: list[int],
        color: list[int] | tuple[int, int, int] = (255, 255, 255),
        step_duration_ms: int = 1000,
        repeat: bool = True,
    ) -> None:
        """
        Starts background loop walking and flashing panel list sequentially.
        Запускает фоновый цикл поочередной подсветки панелей из списка.
        """
        if not panel_ids:
            return

        async with self._lock:
            self._generation += 1
            current_gen = self._generation
            self._cancel_identify_task_locked()
            self._preview_active = False

            self._identify_task = asyncio.create_task(
                self._run_identify_cycle(panel_ids, color, step_duration_ms, repeat, current_gen)
            )

    async def stop_identify_cycle(self) -> None:
        async with self._lock:
            self._generation += 1
            self._cancel_identify_task_locked()
            self._identifying_panel_id = None

        await self.restore_normal_render()

    async def _run_identify_cycle(
        self,
        panel_ids: list[int],
        color: list[int] | tuple[int, int, int],
        step_duration_ms: int,
        repeat: bool,
        gen: int,
    ) -> None:
        try:
            known_panels = await self._get_all_known_panel_ids_async()
            while True:
                for pid in panel_ids:
                    if gen != self._generation:
                        return

                    self._identifying_panel_id = pid
                    plan = self._build_single_panel_plan(pid, color, known_panels)
                    await asyncio.to_thread(self.output.apply_render_plan, plan)

                    await asyncio.sleep(max(200, step_duration_ms) / 1000.0)

                if not repeat or gen != self._generation:
                    break

        except asyncio.CancelledError:
            pass
        finally:
            if gen == self._generation:
                self._identifying_panel_id = None
                await self.restore_normal_render()

    # --- Group Preview / Предварительный просмотр группы ---

    async def preview_group(
        self,
        panel_ids: list[int],
        color: list[int] | tuple[int, int, int],
        transition_time: int = 2,
    ) -> None:
        """
        Temporarily illuminates a group of selected panels without modifying saved config.
        Временно подсвечивает группу выбранных панелей без сохранения в конфиг.
        """
        async with self._lock:
            self._generation += 1
            self._cancel_identify_task_locked()
            self._identifying_panel_id = None
            self._preview_active = True

            all_panels = await self._get_all_known_panel_ids_async()
            chosen_set = set(panel_ids)

            panel_colors: list[PanelColor] = []
            for pid in all_panels:
                if pid in chosen_set:
                    panel_colors.append(
                        PanelColor(
                            panel_id=pid,
                            r=int(color[0]),
                            g=int(color[1]),
                            b=int(color[2]),
                            w=0,
                            transition_time=transition_time,
                        )
                    )
                else:
                    panel_colors.append(
                        PanelColor(
                            panel_id=pid,
                            r=0,
                            g=0,
                            b=0,
                            w=0,
                            transition_time=transition_time,
                        )
                    )

            panel_colors_tuple = tuple(panel_colors)
            fingerprint = compute_render_fingerprint(
                anim_type="static",
                panel_colors=panel_colors_tuple,
                panel_animations=(),
                config_revision=self.config.get_config().revision,
            )

            plan = RenderPlan(
                anim_type="static",
                panel_colors=panel_colors_tuple,
                panel_animations=(),
                fingerprint=fingerprint,
                metadata={"mode": "setup_preview", "selected_panels": panel_ids},
            )

            await asyncio.to_thread(self.output.apply_render_plan, plan)

    async def clear_preview(self) -> None:
        async with self._lock:
            self._generation += 1
            self._cancel_identify_task_locked()
            self._preview_active = False

        await self.restore_normal_render()

    # --- Save & Delete Validation / Валидация и сохранение ---

    async def validate_mapping_payload(
        self,
        label: str,
        match: str,
        panel_ids: list[int],
        base_color: list[int],
    ) -> None:
        """
        Strictly validates group mapping data before disk persistence.
        Строго валидирует данные группы перед сохранением.
        """
        if not label.strip():
            raise ValueError("Label cannot be empty")
        if not match.strip():
            raise ValueError("Match pattern cannot be empty")

        if len(base_color) != 3 or any(not (0 <= int(c) <= 255) for c in base_color):
            raise ValueError("base_color must be 3 integers in range 0..255")

        if not panel_ids:
            raise ValueError("At least one panel ID must be selected for the group")

        # Check unique panel IDs in group / Проверка уникальности панелей в группе
        if len(panel_ids) != len(set(panel_ids)):
            raise ValueError("Duplicate panel IDs found in group assignment")

        # Check panel IDs exist in layout / Проверка существования панелей в топологии
        known_panels = await self._get_all_known_panel_ids_async()
        if known_panels:
            invalid_pids = [pid for pid in panel_ids if pid not in known_panels]
            if invalid_pids:
                raise ValueError(f"Panel IDs {invalid_pids} do not exist in Nanoleaf layout")

        # Check conflicts with other groups / Проверка пересечений с другими группами
        all_groups = self.config.get_config().mapping.devices
        for other in all_groups:
            if other.match.lower() == match.lower():
                continue  # Updating existing group is allowed / Обновление существующей группы разрешено
            conflicts = set(panel_ids).intersection(set(other.panel_ids))
            if conflicts:
                raise ValueError(
                    f"Panel IDs {list(conflicts)} are already assigned to group '{other.label}' ({other.match})"
                )

    async def save_mapping(
        self,
        label: str,
        match: str,
        panel_ids: list[int],
        base_color: list[int],
    ) -> None:
        """
        Validates, saves group mapping atomically, and reapplies updated lighting.
        Валидирует, атомарно сохраняет группу и применяет обновлённую подсветку.
        """
        await self.validate_mapping_payload(label, match, panel_ids, base_color)

        async with self._lock:
            self._generation += 1
            self._cancel_identify_task_locked()
            self._preview_active = False
            self._identifying_panel_id = None

            existing = self.config.get_device_mapping_exact(match)
            if existing:
                self.config.update_device_mapping(
                    match=match,
                    label=label,
                    panel_ids=panel_ids,
                    base_color=base_color,
                )
            else:
                self.config.add_device_mapping(
                    match=match,
                    label=label,
                    panel_ids=panel_ids,
                    base_color=base_color,
                )

            self.config.save()

        # Reapply active lighting plan with new mapping
        await self.restore_normal_render()

    async def restore_normal_render(self) -> RenderPlan | None:
        """
        Restores active lighting render plan.
        Восстанавливает текущий рабочий рендер активного режима.
        """
        try:
            return await self.lighting.apply_batteries(force=True)
        except Exception:
            logger.exception("Failed to restore normal lighting render")
            return None

    # --- Helper methods ---

    def _cancel_identify_task_locked(self) -> None:
        if self._identify_task is not None and not self._identify_task.done():
            self._identify_task.cancel()
            self._identify_task = None

    def _get_all_known_panel_ids(self) -> set[int]:
        if self._cached_panel_ids is not None:
            return set(self._cached_panel_ids)

        pids: set[int] = set()
        for g in self.config.get_config().mapping.devices:
            for pid in g.panel_ids:
                if pid > 0:
                    pids.add(pid)
        return pids

    async def _get_all_known_panel_ids_async(self) -> set[int]:
        if self._cached_panel_ids is not None:
            return set(self._cached_panel_ids)

        try:
            pids = set(await asyncio.to_thread(self.output.get_panel_ids))
        except Exception:
            pids = set()

        for g in self.config.get_config().mapping.devices:
            for pid in g.panel_ids:
                if pid > 0:
                    pids.add(pid)

        return {p for p in pids if p > 0}

    def _build_single_panel_plan(
        self,
        active_panel_id: int,
        color: list[int] | tuple[int, int, int],
        known_panel_ids: set[int] | None = None,
    ) -> RenderPlan:
        all_panels = set(known_panel_ids) if known_panel_ids is not None else self._get_all_known_panel_ids()
        if active_panel_id not in all_panels:
            all_panels.add(active_panel_id)

        panel_colors: list[PanelColor] = []
        for pid in sorted(all_panels):
            if pid == active_panel_id:
                panel_colors.append(
                    PanelColor(
                        panel_id=pid,
                        r=int(color[0]),
                        g=int(color[1]),
                        b=int(color[2]),
                        w=0,
                        transition_time=1,
                    )
                )
            else:
                panel_colors.append(
                    PanelColor(
                        panel_id=pid,
                        r=0,
                        g=0,
                        b=0,
                        w=0,
                        transition_time=1,
                    )
                )

        panel_colors_tuple = tuple(panel_colors)
        fingerprint = compute_render_fingerprint(
            anim_type="static",
            panel_colors=panel_colors_tuple,
            panel_animations=(),
            config_revision=self.config.get_config().revision,
        )

        return RenderPlan(
            anim_type="static",
            panel_colors=panel_colors_tuple,
            panel_animations=(),
            fingerprint=fingerprint,
            metadata={"mode": "setup_identify", "identifying_panel": active_panel_id},
        )
