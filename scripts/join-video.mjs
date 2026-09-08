import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

// Joins clips into one submission video, re-encoding so the parts match exactly.
// Usage: node scripts/join-video.mjs out.mp4 a.mp4 b.mp4 [...]
const [out, ...parts] = process.argv.slice(2);
if (!out || parts.length < 2) { console.error("usage: join-video.mjs out.mp4 part1.mp4 part2.mp4 ..."); process.exit(2); }

const inputs = parts.flatMap((p) => ["-i", p]);
const chain = parts.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("") + `concat=n=${parts.length}:v=1:a=1[v][araw];[araw]loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
execFileSync(ffmpegPath, ["-y", "-loglevel", "error", ...inputs,
  "-filter_complex", chain, "-map", "[v]", "-map", "[a]",
  "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], { stdio: "inherit" });

const dur = (f) => { try { execFileSync(ffmpegPath, ["-i", f], { stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { const m = String(e.stderr).match(/Duration: ([\d:.]+)/); return m ? m[1] : "?"; } return "?"; };
console.log("done:", out, dur(out));
