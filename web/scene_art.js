// The Scene builder's little illustrated preview. Pure drawing: no prompt logic lives here.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function mix(a, b, t) {
  const h = x => [1, 3, 5].map(i => parseInt(x.length === 4 ? x[Math.ceil(i / 2)].repeat(2) : x.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// A rough look for a place from its words, so Places and your own places get a fitting picture.
export function kindOf(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(garage|subway|concrete|parking|tunnel)\b/.test(t)) return "garage";
  if (/\b(beach|ocean|sea|dunes|shore|waves|boardwalk|coast)\b/.test(t)) return "beach";
  if (/\b(desert|mesa|canyon|cactus)\b/.test(t)) return "desert";
  if (/\b(mountain|peaks|lake|alpine)\b/.test(t)) return "mountain";
  if (/\b(forest|trees|pine|ferns|monstera|jungle|vines|greenhouse|garden)\b/.test(t)) return "forest";
  if (/\b(field|meadow|hills|vineyard|grapevines|farm|wheat|grass)\b/.test(t)) return "field";
  if (/\b(street|taxis|traffic|city|towers|skyline|rooftop|sidewalk|cobbled|chalets|village|market|awning|canopy)\b/.test(t)) return "city";
  if (/\b(studio|backdrop|seamless|sweep|gallery)\b/.test(t)) return "studio";
  return "interior";
}
export function timeOf(text) {
  const t = String(text || "").toLowerCase();
  if (/\bnight|neon|fluorescent\b/.test(t)) return "night";
  if (/blue hour|dusk|twilight|glowing windows/.test(t)) return "bluehour";
  if (/golden hour|late afternoon/.test(t)) return "golden";
  if (/sunset/.test(t)) return "sunset";
  if (/sunrise|dawn/.test(t)) return "sunrise";
  if (/morning/.test(t)) return "morning";
  return "midday";
}

function view(s, kind, time, on, plate) {
    const SKY = { sunrise: ["#5d6aa8", "#f3b98e"], morning: ["#9ec3e6", "#e6eef3"], midday: ["#5f9fd8", "#bcdcf2"], golden: ["#d98a4a", "#f6d08a"], sunset: ["#4b3a78", "#f08a5d"], bluehour: ["#1d2a55", "#5872a8"], night: ["#05070f", "#1a2140"] };
    let [sky1, sky2] = SKY[time];
    const dark = time === "night" || time === "bluehour";
    const w = s.weather || "";
    if (w === "overcast" || w === "rain") { sky1 = mix(sky1, "#6b7280", 0.55); sky2 = mix(sky2, "#8d939c", 0.55); }
    if (w === "snow" || w === "fog") { sky1 = mix(sky1, "#c9ced6", 0.5); sky2 = mix(sky2, "#e4e7ec", 0.5); }
    const indoor = kind === "interior" || kind === "studio" || kind === "garage";
    const SUN = { sunrise: [120, 290], morning: [110, 150], midday: [290, 70], golden: [300, 250], sunset: [270, 285], bluehour: [300, 95], night: [300, 80] };
    const [sunX, sunY] = SUN[time];
    const sunColor = dark ? "#e8ecf5" : time === "midday" || time === "morning" ? "#fff6dc" : "#ffd89a";
    const n = v => Math.round(v * 10) / 10;
    // scenery by kind
    let far = "M 0 0", mid = "M 0 0", ground = "M 0 0", detail = "M 0 0", lights = "M 0 0";
    let farFill = "#000", midFill = "#000", groundFill = "#222", detailFill = "none", detailStroke = "none", detailWidth = 0, detailOpacity = 1;
    const shade = (hex, amt) => mix(hex, dark ? "#05060b" : "#1a1c22", amt);
    if (kind === "city") {
      let d = "", lt = "", x = 0, i = 0; const H = [150, 95, 185, 120, 210, 140, 105, 175, 130, 160];
      while (x < 400) { const bw = 34 + (i * 13) % 22, h = H[i % H.length]; d += `M ${x} 330 L ${x} ${330 - h} L ${x + bw} ${330 - h} L ${x + bw} 330 Z `;
        for (let yy = 330 - h + 12; yy < 320; yy += 16) for (let xx = x + 6; xx < x + bw - 6; xx += 10) if ((xx * 7 + yy * 3 + i) % 5 < 2) lt += `M ${xx} ${yy} h 4 v 6 h -4 Z `;
        x += bw + 3; i++; }
      far = d; farFill = shade(sky1, 0.62); lights = lt;
      ground = "M 0 330 L 400 330 L 400 420 L 0 420 Z"; groundFill = shade("#3a3c44", 0.4);
      detail = "M 40 380 L 90 380 M 150 380 L 200 380 M 260 380 L 310 380 M 360 380 L 400 380"; detailStroke = "#c8c8c0"; detailWidth = 3; detailOpacity = 0.35;
    } else if (kind === "beach") {
      far = "M 0 300 L 400 300 L 400 320 L 0 320 Z"; farFill = mix(sky2, "#2f6d8f", 0.6);
      mid = "M 0 318 Q 100 308 200 318 T 400 318 L 400 340 L 0 340 Z"; midFill = mix(sky2, "#4f8fae", 0.45);
      ground = "M 0 336 Q 120 326 240 338 T 400 334 L 400 420 L 0 420 Z"; groundFill = mix("#d9c29a", sky2, 0.2);
      detail = "M 20 330 Q 70 324 120 330 M 180 334 Q 240 326 300 334 M 330 330 Q 360 326 395 331"; detailStroke = "#ffffff"; detailWidth = 2; detailOpacity = 0.5;
    } else if (kind === "forest") {
      let d = ""; for (let i = 0; i < 14; i++) { const x = i * 31 - 10, h = 150 + (i * 37) % 70; d += `M ${x} 340 L ${x + 22} ${340 - h} L ${x + 44} 340 Z `; }
      far = d; farFill = shade(mix("#2f5a3a", sky2, 0.25), 0.25);
      let m = ""; for (let i = 0; i < 9; i++) { const x = i * 48 - 20, h = 210 + (i * 53) % 60; m += `M ${x} 360 L ${x + 30} ${360 - h} L ${x + 60} 360 Z `; }
      mid = m; midFill = shade("#1f3d27", 0.3);
      ground = "M 0 350 Q 200 340 400 352 L 400 420 L 0 420 Z"; groundFill = shade("#2c3a22", 0.3);
      detail = "M 170 420 Q 195 380 200 352 Q 205 380 230 420 Z"; detailFill = mix("#8a7a5a", sky2, 0.2); detailOpacity = 0.6;
    } else if (kind === "field") {
      far = "M 0 300 Q 90 270 180 292 T 400 286 L 400 320 L 0 320 Z"; farFill = mix("#5d7a55", sky2, 0.45);
      ground = "M 0 312 Q 200 300 400 314 L 400 420 L 0 420 Z"; groundFill = shade("#5f7d3e", 0.15);
      let d = ""; for (let i = 0; i < 90; i++) { const x = (i * 53) % 400, y = 320 + (i * 29) % 96; d += `M ${x} ${y} m -2.5 0 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0 `; }
      detail = d; detailFill = "#e8c25a"; detailOpacity = 0.85;
    } else if (kind === "desert") {
      far = "M 0 300 L 40 300 L 52 250 L 120 250 L 132 300 L 250 300 L 262 230 L 330 230 L 345 300 L 400 300 L 400 320 L 0 320 Z"; farFill = mix("#a4553a", sky2, 0.3);
      ground = "M 0 312 L 400 312 L 400 420 L 0 420 Z"; groundFill = mix("#c99a6a", sky2, 0.15);
      detail = "M 196 312 L 204 312 L 300 420 L 100 420 Z"; detailFill = shade("#3a3a3e", 0.2); detailOpacity = 0.9;
    } else if (kind === "mountain") {
      far = "M 0 290 L 70 200 L 120 250 L 190 160 L 260 240 L 320 190 L 400 270 L 400 300 L 0 300 Z"; farFill = mix("#4a5a72", sky2, 0.3);
      mid = "M 170 180 L 190 160 L 210 184 L 200 178 L 190 186 Z M 305 204 L 320 190 L 336 206 L 320 202 Z"; midFill = "#f2f4f8";
      ground = "M 0 300 L 400 300 L 400 340 L 0 340 Z M 0 340 Q 200 330 400 342 L 400 420 L 0 420 Z"; groundFill = mix("#3d6680", sky2, 0.35);
      detail = "M 0 300 L 70 360 L 120 330 L 190 380 L 260 340 L 320 370 L 400 320"; detailStroke = farFill; detailWidth = 0; detailOpacity = 0;
    } else if (kind === "interior") {
      sky1 = mix("#d9cbb8", "#000", dark ? 0.65 : 0.05); sky2 = mix("#c9b8a2", "#000", dark ? 0.7 : 0.1);
      far = "M 230 70 L 370 70 L 370 280 L 230 280 Z"; farFill = dark ? "#1a2140" : mix(SKY[time][1], "#ffffff", 0.35);
      mid = "M 298 70 L 302 70 L 302 280 L 298 280 Z M 230 173 L 370 173 L 370 177 L 230 177 Z"; midFill = mix(sky1, "#000", 0.45);
      ground = "M 0 330 L 400 330 L 400 420 L 0 420 Z"; groundFill = mix("#8a6a4c", "#000", dark ? 0.6 : 0.1);
      detail = "M 30 300 L 150 300 Q 160 300 160 310 L 160 335 L 20 335 L 20 310 Q 20 300 30 300 Z"; detailFill = mix("#e9e1d4", "#000", dark ? 0.6 : 0.05); detailOpacity = 0.9;
    } else if (kind === "studio") {
      sky1 = mix("#8e8a86", "#000", dark ? 0.55 : 0); sky2 = mix("#b9b4ae", "#000", dark ? 0.55 : 0);
      ground = "M 0 320 Q 200 300 400 320 L 400 420 L 0 420 Z"; groundFill = mix(sky2, "#ffffff", 0.08);
    } else if (kind === "garage") {
      sky1 = "#26282e"; sky2 = "#3a3c42";
      far = "M 0 90 L 400 90 L 400 110 L 0 110 Z"; farFill = "#1c1d22";
      mid = "M 40 110 L 76 110 L 76 340 L 40 340 Z M 320 110 L 356 110 L 356 340 L 320 340 Z"; midFill = "#4a4c54";
      ground = "M 0 340 L 400 340 L 400 420 L 0 420 Z"; groundFill = "#2d2e33";
      detail = "M 40 300 L 76 300 L 76 340 L 40 340 Z M 320 300 L 356 300 L 356 340 L 320 340 Z"; detailFill = "#d9c24a"; detailOpacity = 0.55;
      lights = "M 170 98 h 60 v 6 h -60 Z";
    } else {
      sky1 = "#17171b"; sky2 = "#111114";
      ground = "M 0 330 L 400 330 L 400 420 L 0 420 Z"; groundFill = "#18181c";
    }
    // weather
    let clouds = "M 0 0", cloudOpacity = 0, cloudColor = dark ? "#2a3050" : "#ffffff", precip = "M 0 0", precipOpacity = 0, precipFill = "none", precipStroke = "#cfd8e8";
    if (!indoor && (w === "clouds" || w === "overcast" || w === "rain")) {
      clouds = [[60, 70, 50], [150, 50, 60], [260, 80, 55], [350, 55, 45]].map(([x, y, r]) => `M ${x - r} ${y} a ${r} ${r * 0.42} 0 1 0 ${2 * r} 0 a ${r} ${r * 0.42} 0 1 0 ${-2 * r} 0 Z`).join(" ");
      cloudOpacity = w === "clouds" ? 0.55 : 0.75; if (w !== "clouds") cloudColor = dark ? "#262a38" : "#9aa0aa";
    }
    if (!indoor && w === "rain") { let d = ""; for (let i = 0; i < 120; i++) { const x = (i * 37) % 410, y = (i * 61) % 420; d += `M ${x} ${y} l -4 12 `; } precip = d; precipOpacity = 0.45; }
    if (!indoor && w === "snow") { let d = ""; for (let i = 0; i < 110; i++) { const x = (i * 41) % 400, y = (i * 67) % 420, r = 1 + (i % 3) * 0.6; d += `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 `; } precip = d; precipFill = "#ffffff"; precipStroke = "none"; precipOpacity = 0.85; }
    if (!indoor && w === "wind") { precip = "M 30 120 q 40 -10 80 0 t 80 0 M 180 170 q 40 -10 80 0 t 70 0 M 60 220 q 30 -8 70 0"; precipStroke = "#ffffff"; precipOpacity = 0.35; }
    const fogOpacity = w === "fog" ? 1 : 0;
    if (w === "snow" && !indoor) groundFill = mix(groundFill, "#eef1f6", 0.75);
    const sheenOpacity = w === "rain" && !indoor ? 0.22 : 0;
    // lighting
    const L = s.lighting || "";
    const GLOW = { neon: ["#ff4fa8", 120, 210, 160, 0.7], backlit: [time === "night" ? "#ffd89a" : "#ffcf86", 200, 250, 170, 0.75], candle: ["#ffb35a", 110, 300, 140, 0.6], window: ["#fff2d6", 300, 180, 150, 0.55], hard: ["#fff6dc", sunX, sunY, 120, 0.5], softbox: ["#ffffff", 90, 150, 140, 0.45], natural: ["#fff6e6", 200, 120, 220, 0.25] };
    const g = GLOW[L] || ["#ffffff", 200, 200, 10, 0];
    if (dark && kind === "city") { /* lit windows */ }
    const lightsOn = dark || kind === "garage";
    const rimColor = L === "neon" ? "#7aa2ff" : L === "backlit" ? "#ffd89a" : "#ffffff";
    // mood tint
    const MT = { calm: ["#bcd6ea", 0.35], romantic: ["#f2a6c0", 0.4], moody: ["#1c2540", 0.55], playful: ["#ffd25a", 0.35], nostalgic: ["#d6a05a", 0.5], eerie: ["#5f8a72", 0.5], lux: ["#c9a35a", 0.35] };
    const ERA = { "50s": ["#e6c79a", 0.45], "70s": ["#d9893a", 0.45], "90s": ["#9aa6b0", 0.3], y2k: ["#a9c4ff", 0.35], future: ["#4fd0e0", 0.4] };
    const tintSrc = MT[s.mood] || ERA[s.era] || ["#000", 0];
    const vig = s.era === "70s" || s.era === "50s" || s.mood === "moody" || s.mood === "eerie" ? 1 : 0.5;
    return {
      sky1, sky2, sunX, sunY, sunR: dark ? 16 : 26, sunColor,
      sunOpacity: indoor || kind === "none" ? 0 : (w === "overcast" || w === "rain" || w === "fog") ? 0.15 : 1,
      glowColor: g[0], glowX: g[1], glowY: g[2], glowR: g[3], glowOpacity: g[4],
      clouds, cloudColor, cloudOpacity,
      far, farFill, mid, midFill, ground, groundFill, detail, detailFill, detailStroke, detailWidth, detailOpacity,
      lights, lightsColor: kind === "garage" ? "#f0f2f6" : "#ffd58a", lightsOpacity: lightsOn ? 0.9 : kind === "city" ? 0.15 : 0,
      sheenColor: L === "neon" ? "#ff4fa8" : "#cfd8e8", sheenOpacity,
      figFill: dark ? "#0c0d12" : mix(sky1, "#14151a", 0.82), rimColor, rimOpacity: (L === "neon" || L === "backlit") ? 0.75 : 0,
      figOpacity: plate ? 0 : (on ? 1 : 0.35),
      fogOpacity, precip, precipFill, precipStroke, precipOpacity,
      tint: tintSrc[0], tintOpacity: tintSrc[1], vigOpacity: vig,
    };
}

let uid = 0;
// s: the builder's picks; kind/time: from the location or place. Returns an SVG string.
export function sceneSVG(s, { kind = "none", time = "", on = true, plate = false, aria = "Scene preview" } = {}) {
  const u = "kqs" + (++uid) + "-";
  const v = view(s || {}, kind, s && s.time || time || "midday", on, plate);
  return `<svg role="img" aria-label="${esc(aria)}" width="100%" height="100%" class="kqs-art" viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" style="display: block;">
<defs>
<linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.sky1}"></stop><stop offset="1" stop-color="${v.sky2}"></stop></linearGradient>
<radialGradient id="${u}glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${v.glowColor}" stop-opacity="0.9"></stop><stop offset="1" stop-color="${v.glowColor}" stop-opacity="0"></stop></radialGradient>
<linearGradient id="${u}fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dbe0" stop-opacity="0.15"></stop><stop offset="1" stop-color="#d8dbe0" stop-opacity="0.7"></stop></linearGradient>
<radialGradient id="${u}vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"></stop><stop offset="1" stop-color="#000" stop-opacity="0.55"></stop></radialGradient>
</defs>
<rect x="0" y="0" width="400" height="420" fill="url(#${u}sky)"></rect>
<ellipse cx="${v.glowX}" cy="${v.glowY}" rx="${v.glowR}" ry="${v.glowR}" fill="url(#${u}glow)" opacity="${v.glowOpacity}"></ellipse>
<circle cx="${v.sunX}" cy="${v.sunY}" r="${v.sunR}" fill="${v.sunColor}" opacity="${v.sunOpacity}"></circle>
<path d="${v.clouds}" fill="${v.cloudColor}" opacity="${v.cloudOpacity}"></path>
<path d="${v.far}" fill="${v.farFill}"></path>
<path d="${v.lights}" fill="${v.lightsColor}" opacity="${v.lightsOpacity}"></path>
<path d="${v.mid}" fill="${v.midFill}"></path>
<path d="${v.ground}" fill="${v.groundFill}"></path>
<path d="${v.detail}" fill="${v.detailFill}" stroke="${v.detailStroke}" stroke-width="${v.detailWidth}" stroke-linecap="round" opacity="${v.detailOpacity}"></path>
<rect x="0" y="300" width="400" height="120" fill="${v.sheenColor}" opacity="${v.sheenOpacity}"></rect>
<g opacity="${v.figOpacity}">
<ellipse cx="200" cy="384" rx="30" ry="5" fill="#000" opacity="0.35"></ellipse>
<circle cx="200" cy="250" r="13" fill="${v.figFill}"></circle>
<path d="M 186 268 Q 200 262 214 268 L 220 330 L 208 330 L 206 382 L 196 382 L 194 330 L 180 330 Z" fill="${v.figFill}"></path>
<path d="M 188 268 Q 200 262 212 268 L 216 300 L 184 300 Z" fill="${v.rimColor}" opacity="${v.rimOpacity}"></path>
</g>
<rect x="0" y="0" width="400" height="420" fill="url(#${u}fog)" opacity="${v.fogOpacity}"></rect>
<path d="${v.precip}" fill="${v.precipFill}" stroke="${v.precipStroke}" stroke-width="1.2" stroke-linecap="round" opacity="${v.precipOpacity}"></path>
<rect x="0" y="0" width="400" height="420" fill="${v.tint}" opacity="${v.tintOpacity}" style="mix-blend-mode: soft-light"></rect>
<rect x="0" y="0" width="400" height="420" fill="url(#${u}vig)" opacity="${v.vigOpacity}"></rect>
</svg>
`;
}
