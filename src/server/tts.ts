// Edge TTS engine: voice/lang resolution, DRM token, SSML build and the
// WebSocket synthesis call, with a Google Translate TTS fallback.
import crypto from "crypto";
import WebSocket from "ws";

export function cleanVoiceName(voice: string): string {
  let name = voice;
  if (name.includes(":")) {
    const parts = name.split(":");
    name = parts[parts.length - 1];
  }
  name = name.replace(/[-:](male|female)$/i, "");
  return name;
}

export function getEdgeVoiceAndLang(rawVoiceName: string, defaultLang: string = "es"): { voice: string; lang: string } {
  let voice = cleanVoiceName(rawVoiceName);
  let lang = defaultLang;

  const localeMatch = voice.match(/^([a-z]{2})-([A-Z]{2})/);
  if (localeMatch) {
    lang = localeMatch[0];
  } else {
    const lower = rawVoiceName.toLowerCase();
    if (lower.includes("en-") || lower.includes("us-") || lower.includes("guy") || lower.includes("jenny") || lower.includes("alex") || lower.includes("anna") || lower.includes("bella") || lower.includes("benjamin") || lower.includes("charles") || lower.includes("claire") || lower.includes("david") || lower.includes("diana") || lower.includes("milo") || lower.includes("dean") || lower.includes("chloe") || lower.includes("mia") || lower.includes("puck") || lower.includes("charon") || lower.includes("zephyr")) {
      lang = "en-US";
    } else if (lower.includes("zh-") || lower.includes("cn-") || lower.includes("xiaoxiao") || lower.includes("yunxi") || lower.includes("冰糖") || lower.includes("茉莉") || lower.includes("苏打") || lower.includes("白桦")) {
      lang = "zh-CN";
    } else if (lower.includes("es-") || lower.includes("mx-") || lower.includes("alvaro") || lower.includes("elvira") || lower.includes("dalia") || lower.includes("jorge")) {
      lang = "es-ES";
    } else if (lower.includes("pt-") || lower.includes("br-")) {
      lang = "pt-BR";
    } else if (lower.includes("de-")) {
      lang = "de-DE";
    } else if (lower.includes("fr-")) {
      lang = "fr-FR";
    } else if (lower.includes("it-")) {
      lang = "it-IT";
    } else if (lower.includes("ru-")) {
      lang = "ru-RU";
    } else if (lower.includes("ja-") || lower.includes("jp-")) {
      lang = "ja-JP";
    }
  }

  const lowerRaw = rawVoiceName.toLowerCase();
  if (!voice.includes("-") || voice.length < 5) {
    const isMale = lowerRaw.includes("male") || lowerRaw.includes("guy") || lowerRaw.includes("david") || lowerRaw.includes("charles") || lowerRaw.includes("benjamin") || lowerRaw.includes("puck") || lowerRaw.includes("charon") || lowerRaw.includes("zephyr") || lowerRaw.includes("milo") || lowerRaw.includes("dean") || lowerRaw.includes("suda") || lowerRaw.includes("苏打") || lowerRaw.includes("alvaro") || lowerRaw.includes("jorge") || lowerRaw.includes("terror") || lowerRaw.includes("narrator") || lowerRaw.includes("adam") || lowerRaw.includes("antoni") || lowerRaw.includes("josh");

    if (lang.startsWith("es")) {
      voice = isMale ? "es-ES-AlvaroNeural" : "es-ES-ElviraNeural";
    } else if (lang.startsWith("en")) {
      voice = isMale ? "en-US-GuyNeural" : "en-US-JennyNeural";
    } else if (lang.startsWith("zh")) {
      voice = isMale ? "zh-CN-YunxiNeural" : "zh-CN-XiaoxiaoNeural";
    } else if (lang.startsWith("pt")) {
      voice = isMale ? "pt-BR-JulioNeural" : "pt-BR-FranciscaNeural";
    } else if (lang.startsWith("de")) {
      voice = isMale ? "de-DE-ConradNeural" : "de-DE-AmalaNeural";
    } else if (lang.startsWith("fr")) {
      voice = isMale ? "fr-FR-HenriNeural" : "fr-FR-DeniseNeural";
    } else if (lang.startsWith("it")) {
      voice = isMale ? "it-IT-DiegoNeural" : "it-IT-ElsaNeural";
    } else if (lang.startsWith("ru")) {
      voice = isMale ? "ru-RU-DmitryNeural" : "ru-RU-SvetlanaNeural";
    } else if (lang.startsWith("ja")) {
      voice = isMale ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural";
    } else {
      voice = isMale ? "en-US-GuyNeural" : "en-US-JennyNeural";
    }
  }

  return { voice, lang };
}

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";

export function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const intervals = ticks * (S_TO_NS / 100);
  const strToHash = `${intervals.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

export function getJSStyleDateString(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const dayName = days[d.getUTCDay()];
  const monthName = months[d.getUTCMonth()];
  const dateNum = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');

  return `${dayName} ${monthName} ${dateNum} ${year} ${hours}:${minutes}:${seconds} GMT+0000 (Coordinated Universal Time)`;
}

export function buildSsml(
  text: string,
  voice: string,
  lang: string,
  voiceRate: number,
  voiceVolume: number
): string {
  const cleanText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ratePct = Math.round((voiceRate - 1.0) * 100);
  const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

  const volPct = Math.round((voiceVolume - 1.0) * 100);
  const volStr = volPct >= 0 ? `+${volPct}%` : `${volPct}%`;

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rateStr}' volume='${volStr}'>${cleanText}</prosody></voice></speak>`;
}

// Binary Edge TTS frame: 2-byte big-endian header length, ASCII headers, payload.
export function parseEdgeAudioFrame(buffer: Buffer): Buffer | null {
  if (buffer.length < 2) return null;
  const headerLen = buffer.readUInt16BE(0);
  const header = buffer.toString("utf8", 2, 2 + headerLen);
  if (header.includes("Path: audio") || header.includes("Path:audio")) {
    return buffer.subarray(2 + headerLen);
  }
  return null;
}

export function synthesizeSpeechWithEdge(
  voiceName: string,
  text: string,
  defaultLang: string = "es",
  voiceRate: number = 1.0,
  voiceVolume: number = 1.0
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { voice, lang } = getEdgeVoiceAndLang(voiceName, defaultLang);
    console.log(`[EdgeTTS] Requesting voice: "${voice}" (lang: "${lang}", rate: ${voiceRate}, volume: ${voiceVolume}) for text: "${text.substring(0, 60)}..."`);

    const requestId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const secMsGec = generateSecMsGec();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${requestId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Sec-WebSocket-Version": "13"
      }
    });

    const audioBuffers: Buffer[] = [];
    let isFinished = false;

    ws.on("open", () => {
      const timestampStr = getJSStyleDateString();

      const configPayload = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "true"
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3"
            }
          }
        }
      });

      const configMsg = `X-Timestamp:${timestampStr}Z\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${configPayload}`;
      ws.send(configMsg);

      const ssml = buildSsml(text, voice, lang, voiceRate, voiceVolume);
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestampStr}Z\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        const audioPayload = parseEdgeAudioFrame(Buffer.from(data as any));
        if (audioPayload) {
          audioBuffers.push(audioPayload);
        }
      } else {
        const textMsg = data.toString();
        if (textMsg.includes("Path: turn.end") || textMsg.includes("Path:turn.end")) {
          isFinished = true;
          ws.close();
        }
      }
    });

    ws.on("close", () => {
      if (audioBuffers.length > 0) {
        resolve(Buffer.concat(audioBuffers));
      } else {
        reject(new Error("No audio data received from Edge TTS WebSocket"));
      }
    });

    ws.on("error", (err: Error) => {
      reject(err);
    });

    setTimeout(() => {
      if (!isFinished) {
        ws.close();
        if (audioBuffers.length > 0) {
          resolve(Buffer.concat(audioBuffers));
        } else {
          reject(new Error("Edge TTS timeout"));
        }
      }
    }, 15000);
  });
}

export async function synthesizeSpeechWithElevenLabs(
  voiceName: string,
  text: string,
  _voiceRate: number = 1.0,
  _voiceVolume: number = 1.0,
  apiKey?: string
): Promise<Buffer> {
  // Extract voiceId from e.g. "elevenlabs:21m00Tcm4TlvDq8ikWAM:Adam" or raw voiceId "21m00Tcm4TlvDq8ikWAM"
  let voiceId = voiceName;
  if (voiceId.startsWith("elevenlabs:")) {
    const parts = voiceId.split(":");
    voiceId = parts[1] || parts[0];
  }
  voiceId = voiceId.split("-")[0].trim();

  if (!voiceId || voiceId === "elevenlabs") {
    voiceId = "21m00Tcm4TlvDq8ikWAM"; // Default to Adam
  }

  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("API Key de ElevenLabs no configurada. Agrega ELEVENLABS_API_KEY en tu entorno o configuración.");
  }

  console.log(`[ElevenLabsTTS] Requesting voiceId="${voiceId}" for text: "${text.substring(0, 60)}..."`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`ElevenLabs TTS error (${response.status}): ${errBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function synthesizeSpeech(
  voiceName: string,
  text: string,
  defaultLang: string = "es",
  voiceRate: number = 1.0,
  voiceVolume: number = 1.0,
  ttsProvider?: string,
  apiKey?: string
): Promise<Buffer> {
  const isElevenLabs =
    ttsProvider === "elevenlabs" ||
    voiceName.toLowerCase().startsWith("elevenlabs:") ||
    voiceName.toLowerCase().startsWith("elevenlabs");

  if (isElevenLabs) {
    try {
      return await synthesizeSpeechWithElevenLabs(voiceName, text, voiceRate, voiceVolume, apiKey);
    } catch (err: any) {
      console.warn(`[SpeechSynthesis] ElevenLabs TTS failed (${err.message}). Falling back to Edge TTS.`);
    }
  }

  try {
    return await synthesizeSpeechWithEdge(voiceName, text, defaultLang, voiceRate, voiceVolume);
  } catch (err) {
    console.warn(`[SpeechSynthesis] Edge TTS failed for voice "${voiceName}", falling back to Google TTS:`, err);
    const { lang } = getEdgeVoiceAndLang(voiceName, defaultLang);
    const shortLang = lang.split("-")[0];
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encodeURIComponent(text.substring(0, 200))}`;
    const response = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`Google TTS fallback failed with status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
