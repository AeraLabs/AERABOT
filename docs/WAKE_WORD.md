# AERA Local Wake Word

AERA now has an optional local wake-word boundary built around **sherpa-onnx keyword spotting**.

The AERA app itself does not bundle a wake-word model. This is deliberate: sherpa-onnx source code is Apache-2.0, but model weights can have their own licenses. Verify the license of the exact KWS model before redistribution or commercial use.

## Architecture

```text
microphone
   │
   ▼
sherpa-onnx KeywordSpotter
   │
   ├── heartbeat -> ~/.aera/wakeword/state.json
   └── detection -> ~/.aera/wakeword/event.json
                           │
                           ▼
                       AERA Core
                           │
                         AWAKE
```

No wake audio is uploaded or sent over a network by the bundled companion script.

## Dependencies

Create a local Python environment and install:

```bash
pip install sherpa-onnx sounddevice
```

Download a sherpa-onnx keyword-spotting model whose license is appropriate for your use, plus a matching `keywords.txt`.

The official sherpa-onnx keyword spotting examples require:

- `tokens.txt`
- encoder ONNX model
- decoder ONNX model
- joiner ONNX model
- keyword file

## Run

```bash
python scripts/wakeword/sherpa_wake.py \
  --tokens /path/to/tokens.txt \
  --encoder /path/to/encoder.onnx \
  --decoder /path/to/decoder.onnx \
  --joiner /path/to/joiner.onnx \
  --keywords-file /path/to/keywords.txt \
  --phrase-label AERA
```

Then enable **Wake word** in AERA.

When the local detector fires, AERA consumes a one-shot local event and transitions into `AWAKE`.

## Important current boundary

This phase implements **local hands-free wake detection**, not yet wake-and-dictate in a single continuous audio stream. After AERA wakes, the existing whisper.cpp transcription path remains the speech-command path.

That separation avoids silently recording long microphone buffers and keeps the always-listening component restricted to a tiny keyword spotter.
