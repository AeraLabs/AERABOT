#!/usr/bin/env python3
"""AERA local wake-word companion using sherpa-onnx keyword spotting.

This service never opens a network socket. It reads the microphone locally and
writes heartbeat/event JSON files under ~/.aera/wakeword for the AERA desktop
runtime to consume.

Model files are intentionally NOT bundled. Check the license of the exact
sherpa-onnx keyword-spotting model you choose before redistribution.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import sounddevice as sd
except ImportError:
    print("Missing sounddevice. Install with: pip install sounddevice")
    sys.exit(2)

try:
    import sherpa_onnx
except ImportError:
    print("Missing sherpa-onnx. Install with: pip install sherpa-onnx")
    sys.exit(2)

SCHEMA_VERSION = 1
SAMPLE_RATE = 16000
FRAME_SECONDS = 0.10
ROOT = Path.home() / ".aera" / "wakeword"
STATE = ROOT / "state.json"
EVENT = ROOT / "event.json"

def atomic_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    os.replace(temp, path)

def heartbeat(phrase: str):
    atomic_json(
        STATE,
        {
            "schemaVersion": SCHEMA_VERSION,
            "engine": "sherpa-onnx",
            "phrase": phrase,
            "sampleRate": SAMPLE_RATE,
        },
    )

def emit_event(phrase: str):
    atomic_json(
        EVENT,
        {
            "schemaVersion": SCHEMA_VERSION,
            "engine": "sherpa-onnx",
            "phrase": phrase,
            "detectedAtMs": int(time.time() * 1000),
        },
    )

def existing_file(value: str) -> str:
    path = Path(value)
    if not path.is_file():
        raise argparse.ArgumentTypeError(f"{value} does not exist")
    return str(path)

def args():
    parser = argparse.ArgumentParser(
        description="Run AERA's local sherpa-onnx wake-word companion."
    )
    parser.add_argument("--tokens", required=True, type=existing_file)
    parser.add_argument("--encoder", required=True, type=existing_file)
    parser.add_argument("--decoder", required=True, type=existing_file)
    parser.add_argument("--joiner", required=True, type=existing_file)
    parser.add_argument("--keywords-file", required=True, type=existing_file)
    parser.add_argument("--phrase-label", default="AERA")
    parser.add_argument("--provider", default="cpu")
    parser.add_argument("--num-threads", type=int, default=1)
    parser.add_argument("--keywords-score", type=float, default=1.0)
    parser.add_argument("--keywords-threshold", type=float, default=0.25)
    parser.add_argument("--num-trailing-blanks", type=int, default=1)
    parser.add_argument("--device", type=int, default=None)
    return parser.parse_args()

def main():
    config = args()
    ROOT.mkdir(parents=True, exist_ok=True)

    spotter = sherpa_onnx.KeywordSpotter(
        tokens=config.tokens,
        encoder=config.encoder,
        decoder=config.decoder,
        joiner=config.joiner,
        keywords_file=config.keywords_file,
        num_threads=config.num_threads,
        provider=config.provider,
        keywords_score=config.keywords_score,
        keywords_threshold=config.keywords_threshold,
        num_trailing_blanks=config.num_trailing_blanks,
    )

    stream = spotter.create_stream()
    samples_per_read = int(FRAME_SECONDS * SAMPLE_RATE)
    last_heartbeat = 0.0

    print(
        f"AERA wake-word companion active: {config.phrase_label} "
        f"({config.provider}, {config.num_threads} thread(s))"
    )

    with sd.InputStream(
        channels=1,
        dtype="float32",
        samplerate=SAMPLE_RATE,
        device=config.device,
    ) as microphone:
        while True:
            now = time.monotonic()
            if now - last_heartbeat >= 0.75:
                heartbeat(config.phrase_label)
                last_heartbeat = now

            samples, _ = microphone.read(samples_per_read)
            stream.accept_waveform(SAMPLE_RATE, samples.reshape(-1))

            while spotter.is_ready(stream):
                spotter.decode_stream(stream)

            result = spotter.get_result(stream)
            if result:
                emit_event(config.phrase_label)
                print(f"Detected wake phrase: {config.phrase_label}")
                spotter.reset_stream(stream)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            if STATE.exists():
                STATE.unlink()
        except Exception:
            pass
