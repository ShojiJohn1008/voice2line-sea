import { Readable } from "stream";
import { env } from "../utils/env";

type TranscribeResponse = {
  combinedPhrases?: Array<{ text?: string }>;
  phrases?: Array<{ text?: string }>;
};

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getSpeechEndpoint() {
  if (env.AZURE_SPEECH_ENDPOINT) {
    return env.AZURE_SPEECH_ENDPOINT.replace(/\/$/, "");
  }
  if (!env.AZURE_SPEECH_REGION) {
    throw new Error("AZURE_SPEECH_REGION is required");
  }
  return `https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`;
}

export async function transcribeAudio(buffer: Buffer, filename = "line-audio.m4a"): Promise<string> {
  if (!env.AZURE_SPEECH_KEY) {
    throw new Error("AZURE_SPEECH_KEY is required");
  }

  const formData = new FormData();
  const audioBytes = new Uint8Array(buffer);
  const audioCopy = new ArrayBuffer(audioBytes.byteLength);
  new Uint8Array(audioCopy).set(audioBytes);
  formData.append("audio", new Blob([audioCopy]), filename);
  formData.append("definition", JSON.stringify({
    locales: ["ja-JP"],
    profanityFilterMode: "Masked",
  }));

  const response = await fetch(`${getSpeechEndpoint()}/speechtotext/transcriptions:transcribe?api-version=2024-11-15`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Azure Speech transcription failed: ${response.status} ${details}`);
  }

  const result = await response.json() as TranscribeResponse;
  const combined = result.combinedPhrases?.map((phrase) => phrase.text).filter(Boolean).join("\n").trim();
  if (combined) {
    return combined;
  }

  const phrases = result.phrases?.map((phrase) => phrase.text).filter(Boolean).join("\n").trim();
  if (phrases) {
    return phrases;
  }

  throw new Error("Azure Speech returned empty transcription");
}
