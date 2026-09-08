import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { chromium } from "playwright";

/**
 * Records the live demo as a narrated video.
 *  1. Mandarin narration per step from ElevenLabs (cached).
 *  2. Playwright drives the real page in a real browser and records it, holding
 *     each step at least as long as its narration.
 *  3. Each narration clip is muxed onto the video at the exact moment its step began.
 *
 * Usage: node scripts/record-demo.mjs [--skip-tts] [--out docs/demo_cn.mp4]
 */
const KEY = process.env.ELEVENLABS_API_KEY;
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = "docs/video"; mkdirSync(OUT, { recursive: true });
const outFile = opt("--out") || "docs/demo_cn.mp4";
const script = JSON.parse(readFileSync("docs/narration_demo_cn.json", "utf8"));
const W = 1920, H = 1080, ZOOM = "0.88";
const LEAD = 0.6;   // silence before a step's narration starts
const TAIL = 1.4;   // hold after narration ends before the next step

// ── 1. narration ────────────────────────────────────────────────────────────
const voices = (await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } })).json()).voices;
const voice = voices.find((v) => v.name === script.voice) || voices.find((v) => v.name.toLowerCase().includes(String(script.voice).toLowerCase()));
if (!voice) throw new Error("voice not found: " + script.voice);
console.log("voice", voice.name);

for (const s of script.segments) {
  const mp3 = `${OUT}/demo_${s.id}.mp3`;
  if (args.includes("--skip-tts") && existsSync(mp3)) { console.log("keep", mp3); continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text: s.text, model_id: script.model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`tts ${s.id}: ${r.status} ${await r.text()}`);
  writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  console.log("tts", s.id, s.text.length, "chars");
}

const duration = (f) => { try { execFileSync(ffmpegPath, ["-i", f], { stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } throw new Error("no duration for " + f); };
for (const s of script.segments) s.audio = duration(`${OUT}/demo_${s.id}.mp3`);
console.log("narration total", script.segments.reduce((a, s) => a + s.audio, 0).toFixed(0) + "s");

// ── 2. drive + record ───────────────────────────────────────────────────────
const videoDir = `${OUT}/raw`; mkdirSync(videoDir, { recursive: true });
for (const f of readdirSync(videoDir)) if (f.endsWith(".webm")) try { execFileSync("cmd", ["/c", "del", "/q", `${videoDir}\\${f}`.replace(/\//g, "\\")], { stdio: "ignore" }); } catch {}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size: { width: W, height: H } } });
const page = await ctx.newPage();

// a visible pointer, since a recorded browser draws no cursor
const CURSOR = `(() => { const d = document.createElement('div'); d.id = '__cur';
  d.style.cssText = 'position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(226,109,90,.35);border:2.5px solid #C25E1E;pointer-events:none;transition:left .5s cubic-bezier(.4,0,.2,1),top .5s cubic-bezier(.4,0,.2,1),transform .15s;left:50%;top:60%';
  document.body.appendChild(d);
  window.__moveCur = (x, y) => { d.style.left = x + 'px'; d.style.top = y + 'px'; };
  window.__clickCur = () => { d.style.transform = 'scale(.55)'; setTimeout(() => d.style.transform = 'scale(1)', 160); };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scrollTo = async (where) => {
  const sel = { top: "header", steps: "#s3", proof: ".proof", answer: ".answer", archive: "#archiveCard" }[where];
  if (!sel) return;
  await page.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 90), behavior: "smooth" }); }, sel);
  await sleep(700);
};
const clickAt = async (sel) => {
  const box = await page.locator(sel).boundingBox();
  if (!box) throw new Error("no element " + sel);
  await page.evaluate(([x, y, z]) => window.__moveCur(x / z, y / z), [box.x + box.width / 2, box.y + box.height / 2, Number(ZOOM)]);
  await sleep(600);
  await page.evaluate(() => window.__clickCur());
  await sleep(150);
  await page.locator(sel).click();
};

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.evaluate((z) => { document.body.style.zoom = z; }, ZOOM);
await page.evaluate(CURSOR);
await page.waitForSelector("#modeSealed:not([disabled])");
await sleep(1200);

const marks = [];
const t0 = Date.now();
for (const s of script.segments) {
  const start = (Date.now() - t0) / 1000;
  marks.push({ id: s.id, start, audio: s.audio });
  console.log(`[${start.toFixed(1)}s] ${s.id}`);
  await scrollTo(s.scroll);

  const act = (async () => {
    if (s.action === "sealed") { await clickAt("#modeSealed"); await sleep(800); }
    else if (s.action === "wait-archive") { await page.waitForSelector("#btnFetch:not([disabled])", { timeout: 180000 }); }
    else if (s.action.startsWith("click:")) {
      for (const step of s.action.split("|")) {
        const sel = step.replace(/^click:/, "");
        await clickAt(sel);
        if (sel === "#btnJob") await page.waitForSelector("#btnWork:not([disabled])", { timeout: 180000 });
        if (sel === "#btnWork") await page.waitForSelector("#btnSettle:not([disabled])", { timeout: 180000 });
        if (sel === "#btnSettle") await page.waitForFunction(() => document.querySelector("#st3")?.textContent === "paid", null, { timeout: 180000 });
        if (sel === "#btnFake" || sel === "#btnReplay" || sel === "#btnFetch") await sleep(6000);
        if (sel === "#btnVerify") await sleep(2500);
        await sleep(500);
      }
    }
  })();

  const hold = sleep((LEAD + s.audio + TAIL) * 1000);
  if (s.scrollAfter) { await act; await scrollTo(s.scrollAfter); }
  await Promise.all([act, hold]);
}
const totalVideo = (Date.now() - t0) / 1000;
await sleep(1500);
const video = page.video();
await ctx.close();
await browser.close();
const raw = await video.path();
console.log("recorded", raw, totalVideo.toFixed(1) + "s");

// ── 3. mux narration onto the recording ─────────────────────────────────────
const inputs = ["-i", raw];
for (const m of marks) inputs.push("-i", `${OUT}/demo_${m.id}.mp3`);
const filters = marks.map((m, i) => `[${i + 1}:a]adelay=${Math.round((m.start + LEAD) * 1000)}|${Math.round((m.start + LEAD) * 1000)}[a${i}]`).join(";");
const mix = marks.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${marks.length}:normalize=0:dropout_transition=0[amix];[amix]loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
execFileSync(ffmpegPath, ["-y", "-loglevel", "error", ...inputs,
  "-filter_complex", `${filters};${mix}`,
  "-map", "0:v", "-map", "[a]",
  "-vf", "format=yuv420p", "-r", "30",
  "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-shortest", outFile], { stdio: "inherit" });
writeFileSync(`${OUT}/demo_marks.json`, JSON.stringify(marks, null, 2));
console.log("done:", outFile);
