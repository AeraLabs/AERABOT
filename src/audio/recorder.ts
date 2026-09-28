export interface PcmRecorder {
  stop(): Promise<Uint8Array>;
}

function flatten(chunks: Float32Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function resampleLinear(input: Float32Array, fromRate: number, toRate = 16000) {
  if (fromRate === toRate) return input;
  if (input.length === 0) return new Float32Array();

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const source = index * ratio;
    const left = Math.floor(source);
    const right = Math.min(left + 1, input.length - 1);
    const mix = source - left;
    output[index] = input[left] * (1 - mix) + input[right] * mix;
  }

  return output;
}

export function encodePcmWav(samples: Float32Array, sampleRate = 16000) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(bytes);
}

export async function startPcmRecorder(): Promise<PcmRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is unavailable on this system.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;

  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  let stopped = false;

  return {
    async stop() {
      if (stopped) throw new Error("Voice recording has already stopped.");
      stopped = true;

      processor.disconnect();
      source.disconnect();
      silent.disconnect();
      stream.getTracks().forEach((track) => track.stop());

      const sourceRate = context.sampleRate;
      await context.close();

      const raw = flatten(chunks);
      const resampled = resampleLinear(raw, sourceRate, 16000);
      return encodePcmWav(resampled, 16000);
    },
  };
}
