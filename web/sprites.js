// Hand-drawn pixel sprites for Pinky Promise. Each sprite is a list of rows;
// each character maps to a palette color, "." is transparent.
const SPRITE_PALETTE = {
  B: "#8B5A2B", // beagle brown
  T: "#C58A4F", // beagle tan
  W: "#FBF6EA", // beagle white
  K: "#1E1A17", // eyes / nose / outlines
  P: "#E8798A", // tongue
  F: "#B9834A", // capybara fawn
  D: "#7A4E25", // capybara dark
  O: "#F2A33A", // orange on capybara's head
  L: "#7FBF6A", // orange leaf
  G: "#F2B53A", // coin gold
  H: "#FFE08A", // coin highlight
  S: "#C98D1E", // coin shadow
  R: "#D8432F", // wax seal
  Q: "#F08A73", // wax highlight
  M: "#5FD3A6", // mint (verified)
  Z: "#2E6B5A", // vault green dark
  V: "#4C8F7A", // vault green light
  X: "#E9E4DA", // paper
  C: "#5AB0F0", // sweat drop
};

const BEAGLE_BASE = [
  "................",
  "...BB......BB...",
  "..BBBBTTTTBBBB..",
  "..BBBTTTTTTBBB..",
  "..BBTTWWWWTTBB..",
  "..BBTWWWWWWTBB..",
  "..BBWW#WWW#WBB..",
  "..BB.WWWWWW.BB..",
  ".....WWKKWW.....",
  ".....WWWWWW.....",
  "......W@@W......",
  "....BBBBBBBB....",
  "...BBWWBBBBWWB..",
  "...BBWWBBBBWWB..",
  "...WWWW..WWWW...",
  "...W..W..W..W...",
];
// "#" = eye pixel, "@" = mouth pixels; expressions swap them.
const beagleWith = (eye, mouth, extraRows = {}) => BEAGLE_BASE.map((row, i) => {
  let r = row.replaceAll("#", eye).replaceAll("@", mouth);
  if (extraRows[i]) r = extraRows[i];
  return r;
});

const SPRITES = {
  beagle: {
    idle:    beagleWith("K", "W"),
    happy:   beagleWith("K", "P"),
    working: beagleWith("K", "W", { 4: "..BBTTWWWWTTBBC.", 5: "..BBTWWWWWWTBBC." }), // sweat drop
    sad:     beagleWith("K", "W", { 5: "..BBTKWWWWKTBB..", 6: "..BBWWKWWWKWBB..", 10: "......WWWW......", 9: ".....WKKKKW....." }),
  },
  capy: {
    idle: [
      ".........OO.....",
      "....FF..OOOL.FF.",
      "...FFFFFOOFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFKFFFFFFKFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFDDFFFFF.",
      "...FFFFDKKDFFF..",
      "...FFFFFDDFFFF..",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "...DD.DD..DD.DD.",
      "...DD.DD..DD.DD.",
    ],
    happy: [
      ".........OO.....",
      "....FF..OOOL.FF.",
      "...FFFFFOOFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFKKFFFFKKFF.",
      "..FFKFFKFFKFFKF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFDDFFFFF.",
      "...FFFFDKKDFFF..",
      "...FFFFFDDFFFF..",
      "..FFFKFFFFFFKFF.",
      "..FFFFKKKKKKFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "...DD.DD..DD.DD.",
      "...DD.DD..DD.DD.",
    ],
    sad: [
      ".........OO.....",
      "....FF..OOOL.FF.",
      "...FFFFFOOFFFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFKFFFFFFKFF.",
      "..FFFFFFFFFFFFF.",
      "..FFCFFFFFFFFFF.",
      "..FFFFFFDDFFFFF.",
      "...FFFFDKKDFFF..",
      "...FFFFFDDFFFF..",
      "..FFFFFKKKKFFFF.",
      "..FFFFKFFFFKFFF.",
      "..FFFFFFFFFFFFF.",
      "..FFFFFFFFFFFFF.",
      "...DD.DD..DD.DD.",
      "...DD.DD..DD.DD.",
    ],
  },
  coin: [
    "..GGGG..",
    ".GHHGGG.",
    "GHHGGGGS",
    "GHGGGGGS",
    "GGGGGGSS",
    "GGGGGSSS",
    ".GGGSSS.",
    "..SSSS..",
  ],
  bag: [
    "....KK....",
    "...KGGK...",
    "..KGGGGK..",
    ".KGGGGGGK.",
    "KGGGGGGGGK",
    "KGGGSGGGGK",
    "KGGSGSGGGK",
    "KGGGSGGGGK",
    ".KGGGGGGK.",
    "..KKKKKK..",
  ],
  seal: [
    "...RRRRRR...",
    ".RRRQQRRRRR.",
    "RRRQRRRRRRRR",
    "RRQRRRRRRRRR",
    "RRRRRXXRRRRR",
    "RRRRXRRXRRRR",
    "RRRRXRRXRRRR",
    "RRRRRXXRRRRR",
    "RRRRRRRRRRRR",
    "RRRRRRRRRRRR",
    ".RRRRRRRRRR.",
    "...RRRRRR...",
  ],
  vault: [
    "ZZZZZZZZZZZZZZZZZZZZ",
    "ZVVVVVVVVVVVVVVVVVVZ",
    "ZVZZZZZZZZZZZZZZZZVZ",
    "ZVZVVVVVVVVVVVVVVZVZ",
    "ZVZVZZZZZZZZZZZZVZVZ",
    "ZVZVZVVVVGGVVVVZVZVZ",
    "ZVZVZVVVGGGGVVVZVZVZ",
    "ZVZVZVVVGGGGVVVZVZVZ",
    "ZVZVZVVVVGGVVVVZVZVZ",
    "ZVZVZZZZZZZZZZZZVZVZ",
    "ZVZVVVVVVVVVVVVVVZVZ",
    "ZVZZZZZZZZZZZZZZZZVZ",
    "ZVVVVVVVVVVVVVVVVVVZ",
    "ZZZZZZZZZZZZZZZZZZZZ",
  ],
  check: [
    "......MM",
    ".....MM.",
    "....MM..",
    "MM.MM...",
    ".MMM....",
    "..M.....",
  ],
  cross: [
    "R....R",
    ".R..R.",
    "..RR..",
    "..RR..",
    ".R..R.",
    "R....R",
  ],
};

/** Render a sprite map to an inline SVG string (crisp pixels). */
function spriteSVG(map, scale = 6, palette = SPRITE_PALETTE) {
  const h = map.length, w = Math.max(...map.map((r) => r.length));
  let rects = "";
  map.forEach((row, y) => { [...row].forEach((ch, x) => { const c = palette[ch]; if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; }); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects}</svg>`;
}

if (typeof module !== "undefined") module.exports = { SPRITES, SPRITE_PALETTE, spriteSVG };
