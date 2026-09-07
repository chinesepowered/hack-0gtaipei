import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

// Builds docs/pitch_cn.mp4: one screenshot per Chinese slide, narrated in Mandarin by ElevenLabs.
// Usage: node scripts/narrate.mjs [--voice "Name"] [--skip-tts]
const KEY = process.env.ELEVENLABS_API_KEY;
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const script = JSON.parse(readFileSync("docs/narration_cn.json", "utf8"));
const voiceName = opt("--voice") || script.voice;
const model = script.model || "eleven_multilingual_v2";
const OUT = "docs/video"; mkdirSync(OUT, { recursive: true });
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const W = 1920, H = 1080, PAD = 0.8; // seconds of silence after each slide

// 1. resolve voice id
const voices = (await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } })).json()).voices;
const voice = voices.find((v) => v.name === voiceName) || voices.find((v) => v.name.toLowerCase().includes(voiceName.toLowerCase()));
if (!voice) throw new Error("voice not found: " + voiceName + " (have: " + voices.map((v) => v.name).join(", ") + ")");
console.log("voice", voice.name, voice.voice_id, "model", model);

// 2. TTS per slide
for (const s of script.slides) {
  const mp3 = `${OUT}/slide${s.slide}.mp3`;
  if (args.includes("--skip-tts") && existsSync(mp3)) { console.log("keep", mp3); continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text: s.text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`tts slide ${s.slide}: ${r.status} ${await r.text()}`);
  writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  console.log("tts", mp3, s.text.length, "chars");
}

// 3. screenshots at 1080p
for (const s of script.slides) {
  const png = `${OUT}/slide${s.slide}.png`;
  execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=6000", `--window-size=${W},${H}`, `--screenshot=${process.cwd()}/${png}`, `http://localhost:3000/slides_cn?slide=${s.slide}`], { stdio: "ignore" });
  console.log("shot", png);
}

// 4. duration of each mp3 (parse ffmpeg -i)
const duration = (f) => { try { execFileSync(ffmpegPath, ["-i", f], { stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } throw new Error("no duration for " + f); };

// 5. per-slide clips, then concat
const list = [];
let total = 0;
for (const s of script.slides) {
  const d = duration(`${OUT}/slide${s.slide}.mp3`) + PAD; total += d;
  const clip = `${OUT}/clip${s.slide}.mp4`;
  execFileSync(ffmpegPath, ["-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-i", `${OUT}/slide${s.slide}.png`, "-i", `${OUT}/slide${s.slide}.mp3`,
    "-t", d.toFixed(2), "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-af", `apad=pad_dur=${PAD}`, "-shortest", clip], { stdio: "inherit" });
  list.push(`file 'clip${s.slide}.mp4'`); console.log("clip", clip, d.toFixed(1) + "s");
}
writeFileSync(`${OUT}/list.txt`, list.join("\n"));
execFileSync(ffmpegPath, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${OUT}/list.txt`, "-c", "copy", "docs/pitch_cn.mp4"], { stdio: "inherit" });
console.log(`done: docs/pitch_cn.mp4, ${total.toFixed(0)}s total`);
