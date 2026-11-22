// The person builder's figure: a neutral, clothed mannequin drawn from Build a person picks.
// Pure UI: nothing here affects prompts.

// Swatch colors for the builder's color options, keyed by trait value.
export const SWATCH = {
  hcolor: { "jet black": "#16120f", "dark brown": "#3b2618", "chestnut brown": "#6b3a22", "light brown": "#8a6040", "honey blonde": "#b98a4c",
    "golden blonde": "#d2a65a", "platinum blonde": "#e6dcc4", "strawberry blonde": "#d39064", "auburn": "#8e3b20", "copper red": "#b5501f",
    "silver gray": "#b9b8b4", "pastel pink": "#e7a6b8", "deep burgundy": "#6a1f2e", "burgundy": "#6a1f2e" },
  eyes: { "dark brown": "#3a2415", "warm brown": "#6b4423", "hazel": "#8a7036", "amber": "#b07a24", "green": "#4f7a45", "gray": "#8a9096",
    "gray-green": "#7d8f7a", "blue": "#4a74a8", "pale ice blue": "#a9c7de" },
  skin: { "very fair porcelain": "#f3dccb", "fair": "#ecc9ae", "light": "#e2b897", "light olive": "#d4ad86", "olive": "#c19a6b", "golden tan": "#c08a5b",
    "light brown": "#a87650", "medium brown": "#8a5a3a", "warm deep brown": "#6a4029", "very deep ebony": "#45291b" },
};

function geometry(p) {
  const color = (key, val, fallback) => (SWATCH[key] && SWATCH[key][val]) || fallback;
  const B = { "slim":[40,28,34,13], "petite":[38,27,33,12], "athletic":[48,32,38,15], "toned":[44,30,36,14], "average":[44,34,40,15], "curvy":[42,32,46,15], "hourglass":[44,29,46,15], "soft, full figured":[48,42,50,18], "plus size":[52,48,54,20], "muscular":[54,36,40,19], "broad shouldered":[56,34,38,16], "lanky":[38,26,32,11] };
  let [sw, ww, hw, lw] = B[p.body] || [44, 32, 38, 14];
  if (p.gender === "man") { sw += 4; hw -= 2; }
  const H = { "short": 0.84, "average height": 0.92, "tall": 0.99, "very tall": 1.04 };
  let sc = H[p.height] || 0.94;
  if (p.body === "petite") sc -= 0.04;
  if (p.body === "lanky") sc += 0.02;
  const c = 150, n = v => Math.round(v * 10) / 10;
  const torso = [[c - sw, 114], [c + sw, 114], [c + ww, 226], [c + hw, 276], [c - hw, 276], [c - ww, 226]].map(q => q.join(",")).join(" ");
  const sleeves = [[c - sw - lw - 3, 118], [c - sw + 4, 112], [c - sw + 6, 150], [c - sw - lw - 1, 156]].map(q => q.join(",")).join(" ") + " " + [[c + sw - 6, 150], [c + sw - 4, 112], [c + sw + lw + 3, 118], [c + sw + lw + 1, 156]].map(q => q.join(",")).join(" ");
  const legW = Math.max(lw + 8, hw - 6);
  const pants = [[c - hw, 270], [c + hw, 270], [c + hw - 2, 300], [c - hw + 2, 300]].map(q => q.join(",")).join(" ");
  const len = { "very short cropped": 0, "pixie cut": 0, "chin length": 96, "shoulder length": 132, "long": 196, "very long": 262, "shaved": 0 }[p.length];
  const L = len == null ? 120 : len;
  const type = p.htype || "";
  const vol = { "tight coily": 50, "curly": 42, "locs": 38, "loose beachy wavy": 39, "tousled": 37, "wavy": 35, "sleek straight": 29, "braided": 30 }[type] || 33;
  const amp = type === "loose beachy wavy" ? 8 : type === "wavy" ? 4.5 : type === "tousled" ? 2 : 0;
  const per = type === "loose beachy wavy" ? 46 : 26;
  const curl = type === "curly" ? [5, 14] : type === "tight coily" ? [5, 8] : null;
  const bottom = 40 + L;
  const off = y => {
    let o = amp * Math.sin((y - 64) / per * Math.PI * 2) + (y > 100 ? Math.min(8, (y - 100) * 0.04) : 0);
    if (curl) o += curl[0] * Math.abs(Math.sin((y - 64) / curl[1] * Math.PI));
    return o;
  };
  const sx = (sign, y) => n(c + sign * (vol + off(y)));
  // the crown: an arc over the head, bumpy for curly and coily hair
  const dome = (r, cy, bumps) => {
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const a = Math.PI + (Math.PI * i) / 36;
      const rr = r + (bumps ? bumps[0] * Math.abs(Math.sin(i * Math.PI / (bumps[1] > 10 ? 3 : 2))) : 0);
      pts.push(`${n(c + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a) * 0.95)}`);
    }
    return pts;
  };
  let hairBack = "M 0 0";
  if (L) {
    const ys = []; for (let y = 64; y < bottom; y += 4) ys.push(y); ys.push(bottom);
    const top = dome(vol, 64, curl);
    let d = "M " + top.join(" L ");
    for (const y of ys) d += ` L ${sx(1, y)} ${y}`;
    if (type === "tousled") { const xr = sx(1, bottom), xl = sx(-1, bottom); for (let i = 1; i < 8; i++) d += ` L ${n(xr - (xr - xl) * i / 8)} ${bottom - (i % 2 ? 14 : 0)}`; }
    for (const y of ys.slice().reverse()) d += ` L ${sx(-1, y)} ${y}`;
    hairBack = d + " Z";
  }
  let hairTop;
  const short = p.length === "very short cropped" || p.length === "pixie cut";
  const wavyCap = () => { let d = `M ${c - 29} 70 Q ${c - 31} 32 ${c} 32 Q ${c + 31} 32 ${c + 29} 70`; for (let i = 0; i <= 12; i++) { const x = c + 29 - (58 * i) / 12; d += ` L ${n(x)} ${n(54 + (type === "loose beachy wavy" ? 6 : 4) * Math.sin(i * Math.PI / 2))}`; } return d + " Z"; };
  if (p.length === "shaved") hairTop = `M ${c - 26} 62 Q ${c} 34 ${c + 26} 62 Q ${c} 48 ${c - 26} 62 Z`;
  else if ((curl || type === "locs") && (short || !L)) hairTop = "M " + dome(curl ? 29 + curl[0] : 31, 60, curl || [3, 8]).join(" L ") + ` Q ${c + 20} 50 ${c} 50 Q ${c - 20} 50 ${c - 31} 60 Z`;
  else if (type === "tousled") hairTop = `M ${c - 30} 72 Q ${c - 32} 32 ${c} 32 Q ${c + 32} 32 ${c + 30} 72 L ${c + 22} 54 L ${c + 14} 60 L ${c + 6} 50 L ${c - 4} 58 L ${c - 12} 49 L ${c - 20} 58 L ${c - 24} 52 Z`;
  else if (short && /wavy/.test(type)) hairTop = wavyCap();
  else if (p.length === "very short cropped") hairTop = `M ${c - 27} 64 Q ${c - 28} 36 ${c} 36 Q ${c + 28} 36 ${c + 27} 64 L ${c + 24} 52 L ${c - 24} 52 Z`;
  else if (p.length === "pixie cut") hairTop = `M ${c - 29} 70 Q ${c - 31} 32 ${c} 32 Q ${c + 32} 32 ${c + 29} 66 L ${c + 22} 50 Q ${c + 4} 66 ${c - 20} 60 L ${c - 24} 68 Z`;
  else if (curl || type === "locs") hairTop = "M " + dome(curl ? 31 + curl[0] : 31, 62, curl || [3, 8]).join(" L ") + ` Q ${c + 20} 50 ${c} 50 Q ${c - 20} 50 ${c - 31} 62 Z`;
  else hairTop = `M ${c - 29} 70 Q ${c - 30} 34 ${c} 34 Q ${c + 30} 34 ${c + 29} 70 Q ${c + 18} 50 ${c} 50 Q ${c - 18} 50 ${c - 29} 70 Z`;
  // locks that fall in front of the shoulders, so long and very long read differently
  let front = "M 0 0";
  if (L >= 120 && type !== "braided") {
    const thick = curl ? 22 : type === "tight coily" ? 24 : 15;
    const ys = []; for (let y = 96; y < bottom; y += 4) ys.push(y); ys.push(bottom);
    front = [-1, 1].map(sg => {
      let d = `M ${n(c + sg * (vol - thick + 4))} 92`;
      for (const y of ys) d += ` L ${n(c + sg * (vol + off(y) - 1))} ${y}`;
      if (type === "tousled") d += ` L ${n(c + sg * (vol - thick / 2))} ${bottom - 12}`;
      for (const y of ys.slice().reverse()) d += ` L ${n(c + sg * (vol + off(y) - thick))} ${y}`;
      return d + " Z";
    }).join(" ");
  }
  const bumpy = false;
  let strands = "M 0 0", strandOpacity = "0";
  if (type === "locs" && L) { strands = [-3, -2, -1, 0, 1, 2, 3].map(i => `M ${c + i * 10} 56 L ${c + i * 11} ${bottom - 4}`).join(" "); strandOpacity = "1"; }
  let braid = "M 0 0", braidOpacity = "0";
  if (type === "braided") { braid = L > 60 ? `M ${c + 26} 84 Q ${c + 34} ${40 + L * 0.6} ${c + 30} ${bottom}` : `M ${c - 28} 58 Q ${c} 30 ${c + 28} 58`; braidOpacity = "1"; }
  const shine = type === "sleek straight" && p.length !== "shaved" ? `M ${c - 16} 42 Q ${c - 4} 36 ${c + 8} 40` : "M 0 0";
  const cx = p.complexion || "";
  return {
    scale: `translate(150 500) scale(${n(sc)}) translate(-150 -500)`,
    topY: n(500 - (500 - 36) * sc), labelY: n(500 - (500 - 36) * sc + 4),
    heightLabel: ({ "short": "Short", "average height": "Average", "tall": "Tall", "very tall": "Very tall" })[p.height] || "Any",
    skin: color("skin", p.skin, "#b39a86"), hair: color("hcolor", p.hcolor, "#5a4a3e"), eye: color("eyes", p.eyes, "#3a2a20"),
    hairBack, hairTop, hairOpacity: p.length === "shaved" ? "0.55" : "1",
    hairEdge: bumpy ? (type === "tight coily" ? "9" : "7") : "0", hairDash: bumpy ? (type === "tight coily" ? "1 6" : "1 8") : "0",
    braid, braidOpacity, strands, strandOpacity, shine, front,
    torso, sleeves, pants, lw, lr: n(lw / 2),
    armLx: c - sw - lw - 2, armRx: c + sw + 2,
    legLx: c - legW - 2, legRx: c + 2, legW,
    footL: n(c - legW / 2 - 4), footR: n(c + legW / 2 + 4),
    rosy: /rosy|sun-kissed/.test(cx) ? "0.55" : "0",
    freckles: /densely/.test(cx) ? "0.9" : /faintly/.test(cx) ? "0.45" : "0",
    mark: /beauty/.test(cx) ? "1" : "0",
  };
}

const attrs = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(" ");

// The full figure as an SVG string (viewBox 0 0 300 520).
export function figureSVG(p, { label = "", width = 270, height = 440 } = {}) {
  const f = geometry(p || {});
  const hair = (d, extra = {}) => `<path ${attrs({ d, fill: f.hair, stroke: f.hair, "stroke-width": f.hairEdge, "stroke-dasharray": f.hairDash, "stroke-linecap": "round", opacity: f.hairOpacity, ...extra })}/>`;
  return `<svg role="img" aria-label="${String(label).replace(/"/g, "&quot;")}" width="${width}" height="${height}" viewBox="0 0 300 520">
  <ellipse cx="150" cy="502" rx="90" ry="6" fill="#000" opacity=".35"/>
  <line x1="262" y1="${f.topY}" x2="262" y2="500" stroke="#2c2c33" stroke-width="1.5"/>
  <line x1="256" y1="${f.topY}" x2="268" y2="${f.topY}" stroke="#2c2c33" stroke-width="1.5"/>
  <text x="272" y="${f.labelY}" fill="#6e6e78" font-family="Inter, system-ui, sans-serif" font-size="12">${f.heightLabel}</text>
  <g transform="${f.scale}">
    ${hair(f.hairBack)}
    <path d="${f.strands}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" opacity="${f.strandOpacity}" style="mix-blend-mode:multiply"/>
    <rect x="${f.armLx}" y="112" width="${f.lw}" height="176" rx="${f.lr}" fill="${f.skin}"/>
    <rect x="${f.armRx}" y="112" width="${f.lw}" height="176" rx="${f.lr}" fill="${f.skin}"/>
    <rect x="${f.legLx}" y="282" width="${f.legW}" height="210" rx="${f.lr}" fill="#3a3d45"/>
    <rect x="${f.legRx}" y="282" width="${f.legW}" height="210" rx="${f.lr}" fill="#3a3d45"/>
    <ellipse cx="${f.footL}" cy="494" rx="16" ry="7" fill="#24262b"/>
    <ellipse cx="${f.footR}" cy="494" rx="16" ry="7" fill="#24262b"/>
    <polygon points="${f.pants}" fill="#3a3d45"/>
    <rect x="141" y="92" width="18" height="24" rx="6" fill="${f.skin}"/>
    <polygon points="${f.torso}" fill="#5a5e68"/>
    <polygon points="${f.sleeves}" fill="#5a5e68"/>
    <path d="${f.front}" fill="${f.hair}" opacity="${f.hairOpacity}"/>
    <ellipse cx="150" cy="70" rx="26" ry="31" fill="${f.skin}"/>
    ${hair(f.hairTop)}
    <path d="${f.shine}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
    <circle cx="140" cy="72" r="3.2" fill="${f.eye}"/>
    <circle cx="160" cy="72" r="3.2" fill="${f.eye}"/>
    <ellipse cx="134" cy="84" rx="6" ry="3.5" fill="#d9776f" opacity="${f.rosy}"/>
    <ellipse cx="166" cy="84" rx="6" ry="3.5" fill="#d9776f" opacity="${f.rosy}"/>
    <g fill="#7a4a32" opacity="${f.freckles}"><circle cx="135" cy="80" r="1"/><circle cx="139" cy="83" r="1"/><circle cx="132" cy="84" r="1"/><circle cx="161" cy="80" r="1"/><circle cx="165" cy="83" r="1"/><circle cx="168" cy="80" r="1"/><circle cx="146" cy="81" r=".9"/><circle cx="154" cy="81" r=".9"/></g>
    <circle cx="163" cy="90" r="1.6" fill="#3b2418" opacity="${f.mark}"/>
    <path d="${f.braid}" fill="none" stroke="${f.hair}" stroke-width="11" stroke-linecap="round" stroke-dasharray="8 3" opacity="${f.braidOpacity}"/>
  </g>
</svg>`;
}

// A small round avatar (head and shoulders) for headers.
export function avatarSVG(p, size = 24) {
  p = p || {};
  const skin = SWATCH.skin[p.skin] || "#b39a86", hair = SWATCH.hcolor[p.hcolor] || "#5a4a3e";
  const long = /long|shoulder/.test(p.length || ""), none = p.length === "shaved";
  return `<svg width="${size}" height="${size}" viewBox="0 0 34 34" aria-hidden="true" style="border-radius:50%;background:#1c1c20;flex:0 0 auto">
    <path d="M 6 34 Q 6 22 17 22 Q 28 22 28 34 Z" fill="#6f7480"/>
    ${none ? "" : `<path d="${long ? "M 8 17 Q 7 4 17 4 Q 27 4 26 17 L 26 26 L 8 26 Z" : "M 9 15 Q 8 4 17 4 Q 26 4 25 15 Z"}" fill="${hair}"/>`}
    <circle cx="17" cy="14" r="7" fill="${skin}"/></svg>`;
}
