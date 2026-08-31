from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any

import numpy as np

try:
    import pyaudiowpatch as pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False

try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except ImportError:
    HAS_SOUNDDEVICE = False

import threading

from config.manager import ConfigManager
from domain.models import RGB, PanelColor
from domain.ports import LightingOutputPort
from lighting.renderer import clamp, scale_rgb

logger = logging.getLogger(__name__)


class AudioEngine:
    """
    Real-time FFT audio visualizer engine.
    Captures live desktop system audio output (Windows WASAPI Loopback - Spotify, YouTube, Games, etc.)
    computes 3-band spectrum (Bass, Mids, Highs), and streams real-time color frames
    to Nanoleaf panels over UDP/HTTP.

    Движок музыкального спектроанализатора в реальном времени.
    Захватывает системный звук Windows (WASAPI Loopback - Spotify, YouTube, игры),
    рассчитывает 3-полосный спектр (басы, средние, высокие) и транслирует кадры цвета
    на панели Nanoleaf по UDP/HTTP.
    """

    def __init__(
        self,
        config_manager: ConfigManager,
        output: LightingOutputPort,
        on_frame_rendered: Callable[[tuple[PanelColor, ...]], Any] | None = None,
    ) -> None:
        self.config_manager = config_manager
        self.output = output
        self.on_frame_rendered = on_frame_rendered
        self._pa: Any | None = None
        self._pa_stream: Any | None = None
        self._sd_stream: Any | None = None
        self._running = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._last_send_time = 0.0
        self._fps_limit = 35.0
        self._min_interval = 1.0 / self._fps_limit
        self._engine_lock = threading.RLock()

        # Peak followers for smooth responsive decay / Пиковые детекторы для плавного затухания
        self._bass_peak = 0.0
        self._mid_peak = 0.0
        self._high_peak = 0.0

    def start(self, loop: asyncio.AbstractEventLoop) -> bool:
        with self._engine_lock:
            if self._running:
                return True

            self._loop = loop
            self._running = True

            # Try to initialize ExtControl UDP on Nanoleaf if supported
            # Инициализация UDP ExtControl на Nanoleaf при поддержке
            if hasattr(self.output, "init_ext_control"):
                try:
                    self.output.init_ext_control()
                except Exception as e:
                    logger.debug("init_ext_control error: %s", e)

            # 1. Try PyAudioWPatch WASAPI Loopback (Captures PC Desktop Sound: Spotify, Games, YouTube)
            # 1. Захват звука ПК через WASAPI Loopback (PyAudioWPatch)
            if HAS_PYAUDIO:
                try:
                    self._pa = pyaudio.PyAudio()
                    wasapi_info = self._pa.get_host_api_info_by_type(pyaudio.paWASAPI)
                    default_speakers = self._pa.get_device_info_by_index(wasapi_info["defaultOutputDevice"])

                    # Look for loopback device corresponding to default output
                    loopback_device = None
                    if default_speakers.get("isLoopbackDevice"):
                        loopback_device = default_speakers
                    else:
                        for lb in self._pa.get_loopback_device_info_generator():
                            if default_speakers["name"] in lb["name"]:
                                loopback_device = lb
                                break
                        if loopback_device is None:
                            loopback_device = self._pa.get_default_wasapi_loopback()

                    sample_rate = int(loopback_device["defaultSampleRate"])
                    channels = int(loopback_device["maxInputChannels"])

                    def pa_callback(in_data: bytes, frame_count: int, time_info: Any, status: Any) -> Any:
                        if not self._running:
                            return (None, pyaudio.paAbort)

                        audio_array = np.frombuffer(in_data, dtype=np.int16)
                        if channels > 1:
                            # Take left channel or mean of stereo channels
                            audio_array = audio_array.reshape(-1, channels)[:, 0]

                        self._process_samples(audio_array.astype(np.float32) / 32768.0, sample_rate)
                        return (None, pyaudio.paContinue)

                    self._pa_stream = self._pa.open(
                        format=pyaudio.paInt16,
                        channels=channels,
                        rate=sample_rate,
                        input=True,
                        input_device_index=loopback_device["index"],
                        frames_per_buffer=1024,
                        stream_callback=pa_callback,
                    )
                    self._pa_stream.start_stream()
                    logger.info(
                        "Real-time Desktop Audio Loopback stream started on '%s' (%d Hz, %d ch)",
                        loopback_device["name"],
                        sample_rate,
                        channels,
                    )
                    return True
                except Exception as e:
                    logger.warning("PyAudioWPatch loopback failed: %s. Trying sounddevice fallback...", e)
                    if self._pa_stream:
                        try:
                            self._pa_stream.close()
                        except Exception:
                            pass
                        self._pa_stream = None
                    if self._pa:
                        try:
                            self._pa.terminate()
                        except Exception:
                            pass
                        self._pa = None

            # 2. SoundDevice Fallback (Captures default mic / input device)
            # 2. Fallback через sounddevice (микрофон)
            if HAS_SOUNDDEVICE:
                try:
                    def sd_callback(indata: np.ndarray, frames: int, time_info: Any, status: Any) -> None:
                        if not self._running:
                            return
                        self._process_samples(indata[:, 0], 44100)

                    self._sd_stream = sd.InputStream(
                        channels=1,
                        samplerate=44100,
                        blocksize=1024,
                        callback=sd_callback,
                    )
                    self._sd_stream.start()
                    logger.info("Real-time sounddevice microphone stream started (44.1kHz / FFT 1024)")
                    return True
                except Exception as e:
                    logger.error("Failed to start sounddevice audio stream: %s", e)

            self._running = False
            return False

    def stop(self) -> None:
        with self._engine_lock:
            if not self._running and self._pa_stream is None and self._sd_stream is None:
                return

            self._running = False
            if self._pa_stream is not None:
                try:
                    self._pa_stream.stop_stream()
                    self._pa_stream.close()
                except Exception as e:
                    logger.debug("Error closing pyaudio stream: %s", e)
                self._pa_stream = None

            if self._pa is not None:
                try:
                    self._pa.terminate()
                except Exception as e:
                    logger.debug("Error terminating pyaudio: %s", e)
                self._pa = None

            if self._sd_stream is not None:
                try:
                    self._sd_stream.stop()
                    self._sd_stream.close()
                except Exception as e:
                    logger.debug("Error closing sounddevice stream: %s", e)
                self._sd_stream = None

            logger.info("Real-time Audio Reactive engine stopped")

    def _process_samples(self, samples: np.ndarray, sample_rate: int) -> None:
        now = time.monotonic()
        if now - self._last_send_time < self._min_interval:
            return
        self._last_send_time = now

        cfg = self.config_manager.get_config()
        if cfg.mode.active != "audio" or not cfg.mode.audio.enabled:
            return

        audio_cfg = cfg.mode.audio
        sensitivity = float(audio_cfg.sensitivity)
        decay = float(audio_cfg.decay_speed)
        min_b = float(audio_cfg.min_brightness)

        # Clean any NaN / Inf in audio samples
        samples = np.nan_to_num(samples, nan=0.0, posinf=1.0, neginf=-1.0)

        # Compute FFT magnitude spectrum / Вычисление спектра амплитуд FFT
        num_samples = len(samples)
        if num_samples < 64:
            return

        windowed = samples * np.hanning(num_samples)
        fft_vals = np.abs(np.fft.rfft(windowed))
        num_bins = len(fft_vals)

        # Frequency resolution df = sample_rate / num_samples
        df = float(sample_rate) / float(num_samples)

        # Dynamic frequency bin mapping / Динамическое разбиение на частотные полосы
        b_end = max(2, int(250.0 / df))
        m_end = max(b_end + 1, int(4000.0 / df))
        h_end = min(num_bins, max(m_end + 1, int(16000.0 / df)))

        bass_raw = float(np.mean(fft_vals[1:b_end]) * 1.2 * sensitivity if b_end > 1 else 0.0)
        mid_raw = float(np.mean(fft_vals[b_end:m_end]) * 1.8 * sensitivity if m_end > b_end else 0.0)
        high_raw = float(np.mean(fft_vals[m_end:h_end]) * 3.0 * sensitivity if h_end > m_end else 0.0)

        if not np.isfinite(bass_raw):
            bass_raw = 0.0
        if not np.isfinite(mid_raw):
            mid_raw = 0.0
        if not np.isfinite(high_raw):
            high_raw = 0.0

        # Peak decay smoothing / Сглаживание пиковых значений
        if not np.isfinite(self._bass_peak):
            self._bass_peak = 0.0
        if not np.isfinite(self._mid_peak):
            self._mid_peak = 0.0
        if not np.isfinite(self._high_peak):
            self._high_peak = 0.0

        self._bass_peak = max(bass_raw, self._bass_peak * decay)
        self._mid_peak = max(mid_raw, self._mid_peak * decay)
        self._high_peak = max(high_raw, self._high_peak * decay)

        # Dynamic contrast curve (1.25 gamma) for punchier beats and less noise blowout
        # Динамическая кривая контраста (гамма 1.25) для четких ударов
        bass_energy = clamp(self._bass_peak, 0.0, 1.0) ** 1.25
        mid_energy = clamp(self._mid_peak, 0.0, 1.0) ** 1.25
        high_energy = clamp(self._high_peak, 0.0, 1.0) ** 1.25

        bass_rgb: RGB = (
            int(audio_cfg.bass_color[0]),
            int(audio_cfg.bass_color[1]),
            int(audio_cfg.bass_color[2]),
        )
        mid_rgb: RGB = (
            int(audio_cfg.mid_color[0]),
            int(audio_cfg.mid_color[1]),
            int(audio_cfg.mid_color[2]),
        )
        high_rgb: RGB = (
            int(audio_cfg.high_color[0]),
            int(audio_cfg.high_color[1]),
            int(audio_cfg.high_color[2]),
        )

        cluster_colors = [bass_rgb, mid_rgb, high_rgb]
        cluster_energies = [bass_energy, mid_energy, high_energy]

        panel_colors: list[PanelColor] = []
        for g_idx, dev in enumerate(cfg.mapping.devices):
            base_col = cluster_colors[g_idx % len(cluster_colors)]
            energy = cluster_energies[g_idx % len(cluster_energies)]
            brightness = min_b + (0.95 - min_b) * energy

            r, g, b = scale_rgb(base_col, brightness)
            for pid in dev.panel_ids:
                panel_colors.append(PanelColor(panel_id=int(pid), r=r, g=g, b=b, w=0, transition_time=1))

        if not panel_colors:
            return

        colors_tuple = tuple(panel_colors)

        # Send real-time frame to Nanoleaf over UDP (ExtControl) or throttled HTTP fallback
        # Отправка кадра реального времени на Nanoleaf по UDP или HTTP fallback
        try:
            udp_active = getattr(getattr(self.output, "_client", None), "udp_port", None) is not None
            if udp_active and hasattr(self.output, "send_udp_frame"):
                self.output.send_udp_frame(colors_tuple)
            elif hasattr(self.output, "set_static_panel_colors"):
                # Throttled non-blocking HTTP fallback (max 3 fps) to protect PortAudio callback thread
                # Ограниченный неблокирующий HTTP fallback
                if not hasattr(self, "_last_http_send_time"):
                    self._last_http_send_time = 0.0
                if now - self._last_http_send_time >= 0.35:
                    self._last_http_send_time = now
                    threading.Thread(
                        target=self.output.set_static_panel_colors,
                        args=(colors_tuple,),
                        daemon=True,
                    ).start()
        except Exception as e:
            logger.debug("Failed to send audio reactive frame to Nanoleaf: %s", e)

        # Notify async event loop for dashboard live canvas updates
        # Уведомление асинхронного цикла событий для живого обновления в веб-интерфейсе
        if self.on_frame_rendered is not None and self._loop is not None and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self._dispatch_event(colors_tuple),
                self._loop,
            )

    async def _dispatch_event(self, colors: tuple[PanelColor, ...]) -> None:
        if self.on_frame_rendered is not None:
            try:
                res = self.on_frame_rendered(colors)
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass
