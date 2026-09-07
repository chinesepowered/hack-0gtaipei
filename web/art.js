// Pinky Promise character art. Drawn from primitives in a 200×210 space, the
// same way Corgi Club draws its corgi, so it reads as a sibling of that app.
// Everything here returns an SVG string.

const ART = {
  cream: "#FFF6EC", card: "#FFFDF9", cardAlt: "#FBEFDE", sand: "#F5E4CA", line: "#EDDFC9",
  ink: "#33261A", inkSoft: "#8A7660",
  orange: "#E8813A", orangeDeep: "#C25E1E", meadow: "#6FA86A", meadowDeep: "#4E8A52", sky: "#7EC3E0", skyDeep: "#4E9EC4",
  gold: "#F5C453", goldDeep: "#DFA32B", blush: "#F5A28C", danger: "#E26D5A", success: "#63B975", white: "#FFFFFF",
  // beagle coat
  bTan: "#D19A5B", bTanDark: "#B67E44", bBrown: "#8A5A30", bSaddle: "#3E2C20", bWhite: "#FDF9F2", bNose: "#2E211A", bCollar: "#E26D5A",
  // capybara coat
  cFawn: "#B98A5A", cFawnDark: "#9A6F43", cBelly: "#DDB98A", cMuzzle: "#C99E6E", cEar: "#8C6238",
  tongue: "#F08A8F", tongueDeep: "#D96A72", sweat: "#7EC3E0",
};

const S = {
  circle: (cx, cy, r, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`,
  ellipse: (cx, cy, rx, ry, fill, extra = "") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`,
  path: (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`,
  line: (d, stroke, sw, extra = "") => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`,
  rect: (x, y, w, h, rx, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`,
};

const wrap = (inner, size, vb = "0 0 200 210") => {
  const [, , w, h] = vb.split(" ").map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${(size * h) / w}">${inner}</svg>`;
};

// ————— shared face bits —————

function eyesRound(expr, cx1, cx2, cy, rx, ry, ink) {
  const closedL = S.line(`M${cx1 - 9} ${cy} q9 7 18 0`, ink, 4.2);
  const closedR = S.line(`M${cx2 - 9} ${cy} q9 7 18 0`, ink, 4.2);
  if (expr === "happy") return closedL + closedR;
  if (expr === "working") {
    // squint of concentration + a sweat drop
    return S.line(`M${cx1 - 8} ${cy} q8 3 16 0`, ink, 4.2) + S.line(`M${cx2 - 8} ${cy} q8 3 16 0`, ink, 4.2)
      + S.path(`M${cx2 + 30} ${cy - 30} q6 10 0 14 q-6 -4 0 -14 Z`, ART.sweat);
  }
  let out = S.ellipse(cx1, cy, rx, ry, ink) + S.ellipse(cx2, cy, rx, ry, ink)
    + S.circle(cx1 + 2.4, cy - 2.6, 2.2, "#fff") + S.circle(cx2 + 2.4, cy - 2.6, 2.2, "#fff");
  if (expr === "sad") {
    out += S.line(`M${cx1 - 10} ${cy - 9} q8 -8 16 -5`, ink, 3.6) + S.line(`M${cx2 + 10} ${cy - 9} q-8 -8 -16 -5`, ink, 3.6);
  }
  return out;
}

// ————— Beagle —————

export function beagleSVG(expr = "idle", size = 200) {
  const A = ART; const p = [];
  // shadow
  p.push(S.ellipse(100, 196, 58, 9, "#000", 'opacity="0.08"'));
  // tail (behind body), white tip
  p.push(S.line("M146 132 q22 -16 16 -44", A.bBrown, 11));
  p.push(S.circle(163, 86, 7, A.bWhite));
  // body: white haunches with a dark saddle
  p.push(S.ellipse(100, 150, 54, 38, A.bWhite));
  p.push(S.ellipse(100, 128, 46, 20, A.bSaddle));
  p.push(S.ellipse(100, 140, 40, 14, A.bTan, 'opacity="0.55"'));
  p.push(S.ellipse(56, 156, 18, 24, A.bTan, 'opacity="0.35"'));
  p.push(S.ellipse(144, 156, 18, 24, A.bTan, 'opacity="0.35"'));
  p.push(S.ellipse(100, 156, 26, 26, A.bWhite));
  // legs + paws
  for (const s of [-1, 1]) {
    const x = 100 + s * 20;
    p.push(S.rect(x - 8, 148, 16, 40, 8, A.bWhite));
    p.push(S.ellipse(x, 188, 10.5, 7.5, A.bWhite));
    p.push(S.line(`M${x - 3.5} 185 l0 5 M${x + 3.5} 185 l0 5`, "#E2D3BC", 1.6));
  }
  // collar with tag
  p.push(S.line("M72 122 q28 12 56 0", A.bCollar, 7));
  p.push(S.circle(100, 130, 5.5, A.gold));
  // ears: long, floppy, hanging beside the head
  const ear = (s) => {
    const mx = 100 - s * 44;
    return S.path(`M${mx + s * 10} 46 Q${mx - s * 26} 58 ${mx - s * 18} 118 Q${mx - s * 12} 138 ${mx + s * 8} 128 Q${mx + s * 22} 116 ${mx + s * 18} 82 Q${mx + s * 16} 56 ${mx + s * 10} 46 Z`, A.bBrown)
      + S.path(`M${mx + s * 6} 60 Q${mx - s * 14} 70 ${mx - s * 10} 112 Q${mx - s * 6} 124 ${mx + s * 4} 118 Q${mx + s * 12} 108 ${mx + s * 10} 84 Z`, A.bTanDark, 'opacity="0.45"');
  };
  p.push(ear(1), ear(-1));
  // head
  p.push(`<clipPath id="bhead"><ellipse cx="100" cy="80" rx="48" ry="44"/></clipPath>`);
  p.push(S.ellipse(100, 80, 48, 44, A.bTan));
  p.push(`<g clip-path="url(#bhead)">${S.ellipse(100, 56, 50, 30, A.bBrown)}</g>`);
  // blaze
  p.push(S.path("M100 34 q9 3 8 24 l-3 34 q-5 5 -10 0 l-3 -34 q-1 -21 8 -24 Z", A.bWhite));
  // muzzle
  p.push(S.ellipse(100, 102, 28, 21, A.bWhite));
  // cheeks
  p.push(S.ellipse(64, 98, 8, 5, A.blush, 'opacity="0.45"'), S.ellipse(136, 98, 8, 5, A.blush, 'opacity="0.45"'));
  // eyes
  p.push(eyesRound(expr, 76, 124, 82, 6, 7.4, A.ink));
  // nose
  p.push(S.path("M92 94 q8 -6 16 0 q-1 9 -8 9 q-7 0 -8 -9 Z", A.bNose));
  p.push(S.ellipse(96.4, 95.6, 2.4, 1.5, "#5A4438", 'opacity="0.9"'));
  // mouth
  if (expr === "happy") {
    p.push(S.line("M86 106 q14 14 28 0", A.ink, 4));
    p.push(S.path("M93 109 q7 13 14 0 Z", A.tongue));
    p.push(S.line("M100 109 l0 8", A.tongueDeep, 1.6));
  } else if (expr === "sad") {
    p.push(S.line("M88 116 q12 -10 24 0", A.ink, 3.8));
  } else {
    p.push(S.line("M89 106 q5.5 6 11 0 q5.5 6 11 0", A.ink, 3.6));
  }
  return wrap(p.join(""), size);
}

// ————— Capybara —————

export function capySVG(expr = "idle", size = 200) {
  const A = ART; const p = [];
  p.push(S.ellipse(100, 198, 62, 9, "#000", 'opacity="0.08"'));
  // body: a loaf
  p.push(S.ellipse(100, 158, 62, 36, A.cFawn));
  p.push(S.ellipse(100, 172, 38, 16, A.cBelly));
  p.push(S.ellipse(80, 148, 26, 12, A.cBelly, 'opacity="0.25"'));
  // stubby feet
  p.push(S.ellipse(70, 192, 13, 7.5, A.cFawnDark), S.ellipse(130, 192, 13, 7.5, A.cFawnDark));
  p.push(S.line("M65 190 l0 4 M70 189 l0 5 M75 190 l0 4 M125 190 l0 4 M130 189 l0 5 M135 190 l0 4", "#7A5533", 1.4));
  // ears: small rounded, on top
  p.push(S.circle(62, 50, 12, A.cFawnDark), S.circle(138, 50, 12, A.cFawnDark));
  p.push(S.circle(63, 51, 6.5, A.cEar, 'opacity="0.7"'), S.circle(137, 51, 6.5, A.cEar, 'opacity="0.7"'));
  // head: wide and boxy, rounded
  p.push(S.path("M52 60 q0 -22 48 -22 q48 0 48 22 l0 50 q0 26 -48 26 q-48 0 -48 -26 Z", A.cFawn));
  // muzzle: big, flat, slightly lighter
  p.push(S.path("M62 96 q0 -14 38 -14 q38 0 38 14 l0 18 q0 20 -38 20 q-38 0 -38 -20 Z", A.cMuzzle));
  // nostrils
  p.push(S.ellipse(88, 100, 4.5, 3, A.ink), S.ellipse(112, 100, 4.5, 3, A.ink));
  // the yuzu on the head
  p.push(S.circle(130, 30, 10, "#F2A33A"), S.circle(127, 27, 3, "#FFD27A", 'opacity="0.7"'));
  p.push(S.path("M133 20 q8 -8 12 -2 q-6 6 -12 2 Z", A.meadow));
  // cheeks
  p.push(S.ellipse(64, 108, 7, 4.5, A.blush, 'opacity="0.4"'), S.ellipse(136, 108, 7, 4.5, A.blush, 'opacity="0.4"'));
  // eyes: small, wide apart, a little sleepy by nature
  if (expr === "happy") {
    p.push(S.line("M64 78 q8 6 16 0", A.ink, 3.8), S.line("M120 78 q8 6 16 0", A.ink, 3.8));
  } else {
    p.push(S.ellipse(72, 79, 4.6, 5.4, A.ink), S.ellipse(128, 79, 4.6, 5.4, A.ink));
    p.push(S.circle(73.8, 77, 1.6, "#fff"), S.circle(129.8, 77, 1.6, "#fff"));
    if (expr === "sad") {
      p.push(S.line("M62 72 q8 -7 16 -4", A.ink, 3.2), S.line("M138 72 q-8 -7 -16 -4", A.ink, 3.2));
      p.push(S.path("M60 88 q6 10 0 14 q-6 -4 0 -14 Z", A.sweat));
    }
  }
  // mouth
  if (expr === "happy") p.push(S.line("M90 118 q10 9 20 0", A.ink, 3.6));
  else if (expr === "sad") p.push(S.line("M90 124 q10 -8 20 0", A.ink, 3.4));
  else p.push(S.line("M92 118 q4 4 8 0 q4 4 8 0", A.ink, 3.2));
  return wrap(p.join(""), size);
}

// ————— props —————

export function coinSVG(size = 40) {
  const A = ART;
  return wrap(S.circle(20, 20, 18, A.goldDeep) + S.circle(20, 20, 15, A.gold) + S.circle(20, 20, 9, A.goldDeep, 'opacity="0.35"') + S.circle(15, 14, 4, "#fff", 'opacity="0.55"'), size, "0 0 40 40");
}

export function bagSVG(size = 60) {
  const A = ART;
  return wrap(
    S.path("M30 12 q10 -8 20 0 l-4 6 q14 6 16 24 q2 20 -22 22 q-24 -2 -22 -22 q2 -18 16 -24 Z", A.bTanDark)
    + S.path("M30 12 q10 -8 20 0 l-4 6 q14 6 16 24 q2 20 -22 22 q-24 -2 -22 -22 q2 -18 16 -24 Z", "#fff", 'opacity="0.12"')
    + S.line("M26 18 q14 6 28 0", "#6B4A2A", 4)
    + S.circle(40, 42, 9, A.goldDeep) + S.circle(40, 42, 6.5, A.gold),
    size, "0 0 80 68");
}

/** A treasure chest for the escrow. Open = has funds. */
export function chestSVG(open = false, size = 120) {
  const A = ART; const p = [];
  p.push(S.ellipse(60, 84, 50, 7, "#000", 'opacity="0.08"'));
  p.push(S.rect(12, 40, 96, 42, 10, "#8A5A30"));
  p.push(S.rect(12, 40, 96, 8, 4, "#6B4222"));
  p.push(S.rect(30, 40, 8, 42, 3, A.goldDeep), S.rect(82, 40, 8, 42, 3, A.goldDeep));
  if (open) {
    p.push(S.path("M12 40 q0 -30 48 -30 q48 0 48 30 Z", "#5A3618"));
    p.push(S.circle(48, 34, 9, A.gold), S.circle(64, 30, 9, A.gold), S.circle(80, 36, 9, A.gold), S.circle(56, 26, 8, A.goldDeep));
    p.push(S.path("M8 36 q0 -32 52 -32 q52 0 52 32 l-6 0 q0 -26 -46 -26 q-46 0 -46 26 Z", "#8A5A30"));
  } else {
    p.push(S.path("M12 40 q0 -24 48 -24 q48 0 48 24 Z", "#8A5A30"));
    p.push(S.path("M12 40 q0 -24 48 -24 q48 0 48 24", "#fff", 'opacity="0.1"'));
  }
  p.push(S.rect(50, 44, 20, 16, 5, A.gold), S.rect(57, 50, 6, 7, 2, "#6B4222"));
  return wrap(p.join(""), size, "0 0 120 92");
}

/** Wax seal with a paw print — the stamp. */
export function sealSVG(size = 80, ok = true) {
  const A = ART; const base = ok ? A.danger : "#9A8F86"; const dark = ok ? "#C7503F" : "#7A6F66";
  const p = [S.circle(40, 40, 36, dark), S.circle(40, 40, 32, base), S.circle(30, 28, 8, "#fff", 'opacity="0.18"')];
  // paw
  p.push(S.ellipse(40, 47, 11, 9, "#fff", 'opacity="0.9"'));
  p.push(S.circle(27, 34, 5, "#fff", 'opacity="0.9"'), S.circle(36, 27, 5, "#fff", 'opacity="0.9"'), S.circle(46, 27, 5, "#fff", 'opacity="0.9"'), S.circle(54, 34, 5, "#fff", 'opacity="0.9"'));
  return wrap(p.join(""), size, "0 0 80 80");
}

export function pawSVG(size = 24, color = ART.orange) {
  return wrap(S.ellipse(12, 15, 6.5, 5.5, color) + S.circle(4.5, 8.5, 3, color) + S.circle(9.5, 4.5, 3, color) + S.circle(15, 4.5, 3, color) + S.circle(19.5, 8.5, 3, color), size, "0 0 24 24");
}

export function checkSVG(size = 20, ok = true) {
  return ok
    ? wrap(S.circle(10, 10, 10, ART.success) + S.line("M5.5 10.5 l3 3 l6 -7", "#fff", 2.6), size, "0 0 20 20")
    : wrap(S.circle(10, 10, 10, ART.danger) + S.line("M6.5 6.5 l7 7 M13.5 6.5 l-7 7", "#fff", 2.6), size, "0 0 20 20");
}

/** Sky, sun, hills. Fills its container; place characters over it. */
export function sceneSVG(w = 1200, h = 360) {
  const A = ART;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="100%">
    <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A.sky}"/><stop offset="1" stop-color="#EAF4EE"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#skyg)"/>
    <circle cx="${w * 0.6}" cy="${h * 0.26}" r="${h * 0.22}" fill="${A.gold}" opacity="0.25"/>
    <circle cx="${w * 0.6}" cy="${h * 0.26}" r="${h * 0.15}" fill="${A.gold}"/>
    <ellipse cx="${w * 0.25}" cy="${h * 1.02}" rx="${w * 0.55}" ry="${h * 0.42}" fill="${A.meadow}" opacity="0.85"/>
    <ellipse cx="${w * 0.8}" cy="${h * 1.06}" rx="${w * 0.6}" ry="${h * 0.4}" fill="${A.meadowDeep}" opacity="0.9"/>
    <rect y="${h * 0.86}" width="${w}" height="${h * 0.14}" fill="${A.meadowDeep}"/>
  </svg>`;
}

export { ART };
if (typeof window !== "undefined") Object.assign(window, { ART, beagleSVG, capySVG, coinSVG, bagSVG, chestSVG, sealSVG, pawSVG, checkSVG, sceneSVG });
