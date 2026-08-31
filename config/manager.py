from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from .models import AgentServerConfig, AmbientModeConfig, AppConfig, DeviceMappingConfig

logger = logging.getLogger(__name__)


class ConfigManager:
    """
    Thread-safe configuration manager powered by Pydantic v2 with atomic disk persistence.
    Потокобезопасный менеджер конфигурации на базе Pydantic v2 с атомарным сохранением.
    """

    def __init__(self, config_path: str | Path | None = None) -> None:
        self._config_path: Path | None = Path(config_path) if config_path else None
        self._config: AppConfig = AppConfig()
        self._lock = threading.RLock()

        if self._config_path is not None and self._config_path.exists():
            self._load_from_file(self._config_path)
        elif self._config_path is not None:
            # Check for example template file / Проверка наличия шаблонного файла примера
            example_path = self._config_path.with_name(f"{self._config_path.stem}.example.json")
            if example_path.exists():
                logger.info("Config file %s not found, initializing from template %s", self._config_path, example_path)
                self._load_from_file(example_path)
                self.save()
            else:
                logger.info("Config file %s not found, using default AppConfig", self._config_path)

    def _load_from_file(self, path: Path) -> None:
        with self._lock:
            try:
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)

                if not isinstance(data, dict):
                    logger.warning("Config file %s does not contain a JSON object, ignoring", path)
                    return

                self._config = AppConfig.model_validate(data)
                logger.info("Loaded config (rev=%d) from %s", self._config.revision, path)
            except Exception:
                logger.exception("Failed to validate config from %s, using defaults", path)
                self._config = AppConfig()

    def get_config(self) -> AppConfig:
        """
        Returns typed immutable copy of current configuration.
        Возвращает типизированную неизменяемую копию конфигурации.
        """
        with self._lock:
            return self._config

    def set_config(self, new_config: AppConfig) -> None:
        """
        Sets new configuration with incremented revision counter.
        Устанавливает новую конфигурацию с инкрементом ревизии.
        """
        with self._lock:
            new_config.revision = self._config.revision + 1
            self._config = new_config

    def bump_revision(self) -> int:
        with self._lock:
            self._config.revision += 1
            return self._config.revision

    def save(self, path: str | Path | None = None) -> bool:
        with self._lock:
            target_path: Path | None = Path(path) if path is not None else self._config_path

            if target_path is None:
                logger.debug("ConfigManager has no config_path, skipping disk save (in-memory mode)")
                return True

            unique_suffix = f".tmp.{os.getpid()}.{uuid.uuid4().hex[:8]}"
            tmp_path = target_path.with_name(f"{target_path.name}{unique_suffix}")

            try:
                tmp_path.parent.mkdir(parents=True, exist_ok=True)
                with tmp_path.open("w", encoding="utf-8") as f:
                    json.dump(self._config.model_dump_json_dict(), f, indent=2, ensure_ascii=False)

                # Retry on Windows PermissionError / sharing violations
                for attempt in range(4):
                    try:
                        tmp_path.replace(target_path)  # Atomic filesystem replacement / Атомарная замена на файловой системе
                        break
                    except (PermissionError, OSError):
                        if attempt == 3:
                            raise
                        time.sleep(0.02 * (2 ** attempt))

                logger.info("Config saved (rev=%d) to %s", self._config.revision, target_path)
                return True
            except Exception:
                logger.exception("Failed to save config to %s (tmp: %s)", target_path, tmp_path)
                try:
                    if tmp_path.exists():
                        tmp_path.unlink()
                except Exception:
                    logger.exception("Failed to remove tmp config file %s", tmp_path)
                return False

    def reload(self) -> None:
        """
        Reloads configuration from disk file.
        Перечитать конфиг из файла.
        """
        with self._lock:
            if self._config_path is None:
                logger.warning("Cannot reload: ConfigManager has no config_path")
                return

            if not self._config_path.exists():
                logger.warning("Cannot reload: config file %s does not exist", self._config_path)
                return

            self._load_from_file(self._config_path)

    def raw(self) -> dict[str, Any]:
        """
        Returns configuration dictionary for JSON/API serialization.
        Возвращает словарь конфигурации для сериализации в JSON/API.
        """
        return self._config.model_dump_json_dict()

    # --- Convenience getters and setters / Удобные геттеры и сеттеры ---

    def get_active_mode(self) -> str:
        with self._lock:
            return self._config.mode.active.strip().lower() or "battery"

    def set_active_mode(self, mode_name: str) -> None:
        with self._lock:
            self._config.mode.active = str(mode_name).strip().lower()
            self.bump_revision()

    def get_mode_config(self, mode_name: str) -> dict[str, Any]:
        with self._lock:
            mode_dict = self._config.mode.model_dump(mode="json")
            val = mode_dict.get(mode_name, {})
            return val if isinstance(val, dict) else {}

    def get_ambient_config(self) -> AmbientModeConfig:
        with self._lock:
            return self._config.mode.ambient

    def set_ambient_config(
        self,
        *,
        enabled: bool | None = None,
        palette: list[list[int]] | None = None,
        min_brightness_factor: float | None = None,
        max_brightness_factor: float | None = None,
        transition_time: int | None = None,
        phase_offset_per_group: float | None = None,
    ) -> AmbientModeConfig:
        with self._lock:
            amb = self._config.mode.ambient
            if enabled is not None:
                amb.enabled = bool(enabled)
            if palette is not None:
                amb.palette = [[int(ch) for ch in c] for c in palette]
            if min_brightness_factor is not None:
                amb.min_brightness_factor = float(min_brightness_factor)
            if max_brightness_factor is not None:
                amb.max_brightness_factor = float(max_brightness_factor)
            if transition_time is not None:
                amb.transition_time = int(transition_time)
            if phase_offset_per_group is not None:
                amb.phase_offset_per_group = float(phase_offset_per_group)

            # Validate through Pydantic
            self._config.mode.ambient = AmbientModeConfig.model_validate(amb.model_dump(mode="json"))
            self.bump_revision()
            return self._config.mode.ambient

    def get_logic(self) -> dict[str, Any]:
        with self._lock:
            return self._config.logic.model_dump(mode="json")

    def get_transition_time(self) -> int:
        with self._lock:
            return self._config.logic.transition_time

    def set_transition_time(self, value: int | float) -> None:
        with self._lock:
            self._config.logic.transition_time = int(value)
            self.bump_revision()

    def get_white_channel(self) -> int:
        with self._lock:
            return self._config.logic.white_channel

    def set_white_channel(self, value: int) -> None:
        with self._lock:
            self._config.logic.white_channel = int(value)
            self.bump_revision()

    def is_brightness_scale_enabled(self) -> bool:
        with self._lock:
            return self._config.logic.brightness_scale.enabled

    def set_brightness_scale_enabled(self, enabled: bool) -> None:
        with self._lock:
            self._config.logic.brightness_scale.enabled = bool(enabled)
            self.bump_revision()

    def get_brightness_min_factor(self) -> float:
        with self._lock:
            return self._config.logic.brightness_scale.min_factor

    def set_brightness_min_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.brightness_scale.min_factor = float(value)
            self.bump_revision()

    def get_brightness_max_factor(self) -> float:
        with self._lock:
            return self._config.logic.brightness_scale.max_factor

    def set_brightness_max_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.brightness_scale.max_factor = float(value)
            self.bump_revision()

    def get_critical_threshold(self) -> int:
        with self._lock:
            return self._config.logic.thresholds.critical

    def set_critical_threshold(self, value: int) -> None:
        with self._lock:
            self._config.logic.thresholds.critical = int(value)
            self.bump_revision()

    def get_charging_partial_pulse_transition_time(self) -> int:
        with self._lock:
            return self._config.logic.effects.charging_partial.pulse_transition_time

    def set_charging_partial_pulse_transition_time(self, value: int) -> None:
        with self._lock:
            self._config.logic.effects.charging_partial.pulse_transition_time = int(value)
            self.bump_revision()

    def get_charging_partial_min_factor(self) -> float:
        with self._lock:
            return self._config.logic.effects.charging_partial.min_factor

    def set_charging_partial_min_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.effects.charging_partial.min_factor = float(value)
            self.bump_revision()

    def get_charging_partial_max_factor(self) -> float:
        with self._lock:
            return self._config.logic.effects.charging_partial.max_factor

    def set_charging_partial_max_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.effects.charging_partial.max_factor = float(value)
            self.bump_revision()

    def get_charging_full_pulse_transition_time(self) -> int:
        with self._lock:
            return self._config.logic.effects.charging_full.pulse_transition_time

    def set_charging_full_pulse_transition_time(self, value: int) -> None:
        with self._lock:
            self._config.logic.effects.charging_full.pulse_transition_time = int(value)
            self.bump_revision()

    def get_charging_full_min_factor(self) -> float:
        with self._lock:
            return self._config.logic.effects.charging_full.min_factor

    def set_charging_full_min_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.effects.charging_full.min_factor = float(value)
            self.bump_revision()

    def get_charging_full_max_factor(self) -> float:
        with self._lock:
            return self._config.logic.effects.charging_full.max_factor

    def set_charging_full_max_factor(self, value: float) -> None:
        with self._lock:
            self._config.logic.effects.charging_full.max_factor = float(value)
            self.bump_revision()

    def get_critical_pulse_transition_time(self) -> int:
        with self._lock:
            return self._config.logic.effects.critical.pulse_transition_time

    def set_critical_pulse_transition_time(self, value: int) -> None:
        with self._lock:
            self._config.logic.effects.critical.pulse_transition_time = int(value)
            self.bump_revision()

    def get_critical_warning_color(self) -> list[int]:
        with self._lock:
            return list(self._config.logic.effects.critical.warning_color)

    def set_critical_warning_color(self, value: list[int]) -> None:
        with self._lock:
            self._config.logic.effects.critical.warning_color = [int(c) for c in value]
            self.bump_revision()

    def get_effect(self, name: str) -> dict[str, Any]:
        with self._lock:
            effects = self._config.logic.effects.model_dump(mode="json")
            return effects.get(name, {})

    def set_effect(self, name: str, effect_config: dict[str, Any]) -> None:
        with self._lock:
            if name == "charging_partial":
                self._config.logic.effects.charging_partial = self._config.logic.effects.charging_partial.model_validate(effect_config)
            elif name == "charging_full":
                self._config.logic.effects.charging_full = self._config.logic.effects.charging_full.model_validate(effect_config)
            elif name == "critical":
                self._config.logic.effects.critical = self._config.logic.effects.critical.model_validate(effect_config)
            self.bump_revision()

    def get_mapping(self) -> dict[str, Any]:
        with self._lock:
            return self._config.mapping.model_dump(mode="json")

    def get_device_mappings(self) -> list[dict[str, Any]]:
        with self._lock:
            return [item.model_dump(mode="json") for item in self._config.mapping.devices]

    def set_device_mappings(self, devices: list[dict[str, Any]]) -> None:
        with self._lock:
            self._config.mapping.devices = [DeviceMappingConfig.model_validate(d) for d in devices]
            self.bump_revision()

    def find_device_mapping(self, device_name: str) -> dict[str, Any] | None:
        with self._lock:
            name_lower = device_name.lower()
            for mapping in self._config.mapping.devices:
                if mapping.match.lower() in name_lower:
                    return mapping.model_dump(mode="json")
            return None

    def get_device_mapping_exact(self, match: str) -> dict[str, Any] | None:
        with self._lock:
            match_lower = match.lower()
            for mapping in self._config.mapping.devices:
                if mapping.match.lower() == match_lower:
                    return mapping.model_dump(mode="json")
            return None

    def add_device_mapping(
        self,
        match: str,
        label: str,
        panel_ids: list[int],
        base_color: list[int],
    ) -> None:
        with self._lock:
            # Check if exact match already exists to avoid duplicates
            for dev in self._config.mapping.devices:
                if dev.match.lower() == match.lower():
                    dev.label = label
                    dev.panel_ids = list(panel_ids)
                    dev.base_color = [int(c) for c in base_color]
                    self.bump_revision()
                    return

            new_dev = DeviceMappingConfig(
                match=match,
                label=label,
                panel_ids=panel_ids,
                base_color=base_color,
            )
            self._config.mapping.devices.append(new_dev)
            self.bump_revision()

    def update_device_mapping(
        self,
        match: str,
        label: str | None = None,
        panel_ids: list[int] | None = None,
        base_color: list[int] | None = None,
    ) -> bool:
        with self._lock:
            updated = False
            match_lower = match.lower()
            for dev in self._config.mapping.devices:
                if dev.match.lower() == match_lower:
                    if label is not None:
                        dev.label = label
                    if panel_ids is not None:
                        dev.panel_ids = list(panel_ids)
                    if base_color is not None:
                        dev.base_color = [int(c) for c in base_color]
                    updated = True
                    break
            if updated:
                self.bump_revision()
            return updated

    def remove_device_mapping(self, match: str) -> bool:
        with self._lock:
            initial_len = len(self._config.mapping.devices)
            match_lower = match.lower()
            self._config.mapping.devices = [
                d for d in self._config.mapping.devices if d.match.lower() != match_lower
            ]
            removed = len(self._config.mapping.devices) != initial_len
            if removed:
                self.bump_revision()
            return removed

    def get_agent_config(self) -> AgentServerConfig:
        with self._lock:
            return self._config.agent.model_copy(deep=True)

    def set_agent_config(
        self,
        *,
        enabled: bool | None = None,
        pc_offline_action: str | None = None,
        pc_offline_timeout_sec: float | None = None,
    ) -> AgentServerConfig:
        with self._lock:
            if enabled is not None:
                self._config.agent.enabled = bool(enabled)
            if pc_offline_action is not None:
                self._config.agent.pc_offline_action = str(pc_offline_action)
            if pc_offline_timeout_sec is not None:
                self._config.agent.pc_offline_timeout_sec = float(pc_offline_timeout_sec)
            self.bump_revision()
            return self._config.agent.model_copy(deep=True)
