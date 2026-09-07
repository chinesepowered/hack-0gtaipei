// Renders every sprite to one PNG sheet so the art can be checked outside a browser.
import { writeFileSync, readFileSync } from "node:fs";
import zlib from "node:zlib";
const { SPRITES, SPRITE_PALETTE } = new Function("module", readFileSync(new URL("../web/sprites.js", import.meta.url), "utf8") + ";return module.exports;")({});

const S = 8, PAD = 4;
const items = [];
for (const [name, v] of Object.entries(SPRITES)) {
  if (Array.isArray(v)) items.push([name, v]); else for (const [k, m] of Object.entries(v)) items.push([`${name}.${k}`, m]);
}
const cellW = 20 * S + PAD, cellH = 16 * S + PAD, cols = 5;
const W = cols * cellW, H = Math.ceil(items.length / cols) * cellH;
const px = new Uint8Array(W * H * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
for (let i = 0; i < W * H; i++) { px[i * 4] = 22; px[i * 4 + 1] = 58; px[i * 4 + 2] = 49; px[i * 4 + 3] = 255; }
items.forEach(([name, map], idx) => {
  const ox = (idx % cols) * cellW, oy = Math.floor(idx / cols) * cellH;
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = SPRITE_PALETTE[ch]; if (!c) return; const [r, g, b] = hex(c);
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const p = ((oy + y * S + dy) * W + (ox + x * S + dx)) * 4; px[p] = r; px[p + 1] = g; px[p + 2] = b; px[p + 3] = 255; }
  }));
  console.log(idx, name);
});
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
const out = process.argv[2] || "sprites-preview.png";
writeFileSync(out, png); console.log("wrote", out, W + "x" + H);
