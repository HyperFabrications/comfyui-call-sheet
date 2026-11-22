// A neutral figure wearing the outfit, for the Outfit builder and the Outfit node.
// outfitSVG(outfits, state, items, { on, aria, size }) draws state's pieces in their colors.

// Your own items have no shape, so guess one from the words.
function guessShape(cat, text) {
  const t = String(text || "").toLowerCase();
  if (cat === "top") return /\b(tank|cami|camisole|bralette|bra|corset|bustier|halter|bandeau|tube)\b/.test(t) ? "tank" : /\b(sweater|hoodie|sweatshirt|turtleneck|long sleeve|blouse|shirt|pullover|jumper|cardigan)\b/.test(t) ? "long" : "short";
  if (cat === "bottom") return /\bskirt\b/.test(t) ? (/\b(midi|maxi|long|full)\b/.test(t) ? "midi" : "mini") : /\bshorts\b/.test(t) ? "shorts" : /\b(wide|palazzo|flare|culottes)\b/.test(t) ? "wide" : "jeans";
  if (cat === "one") return /\b(jumpsuit|romper|playsuit|overalls|coveralls)\b/.test(t) ? "jump" : /\bsuit\b/.test(t) && !/\b(swim|body)suit\b/.test(t) ? "suit" : /\b(swimsuit|bikini|bodysuit|leotard|teddy)\b/.test(t) ? "swim" : /\b(gown|maxi|floor)\b/.test(t) ? "gown" : /\bmidi\b/.test(t) ? "midi" : /\bmini\b/.test(t) ? "mini" : "knee";
  if (cat === "outer") return /\bpuffer\b/.test(t) ? "puffer" : /\b(long|trench|overcoat|coat|duster|parka)\b/.test(t) ? "long" : "short";
  if (cat === "shoes") return /\b(knee|tall|thigh|riding)\b/.test(t) ? "knee" : /\bboots?\b/.test(t) ? "ankle" : /\b(barefoot|bare)\b/.test(t) ? "bare" : "low";
  if (cat === "acc") return /\b(hoops?|earrings?)\b/.test(t) ? "hoops" : /\b(pearls?|necklace|pendant|choker|locket|chain)\b/.test(t) ? "pearls" : /\b(sunglasses|glasses)\b/.test(t) ? "glasses" : /\bcap\b/.test(t) ? "cap" : /\b(beret|beanie|hat)\b/.test(t) ? "beret" : /\b(scarf|bandana)\b/.test(t) ? "scarf" : /\b(bag|purse|tote|clutch)\b/.test(t) ? "bag" : /\bbelt\b/.test(t) ? "belt" : "";
  return "";
}

// One piece of the outfit: its shape and fill color.
export function lookOf(outfits, cat, value, color, items = []) {
  if (!value) return null;
  const mine = items.find(x => x.id === value);
  if (mine) return { shape: guessShape(cat, mine.text), hex: mine.hex || "#8a8a92", mine: true };
  const c = outfits.categories.find(x => x.key === cat);
  const o = c && c.options.find(x => x.value === value);
  if (!o) return null;
  const col = outfits.colors.find(x => x.value === (color || o.color));
  return { shape: o.shape, hex: col ? col.hex : "#d9b45a", mine: false };
}

export function outfitSVG(outfits, s = {}, items = [], { on = true, aria = "", size = null } = {}) {
  const L = (cat, v, c) => lookOf(outfits, cat, v, c, items);
  const a = { bottom: "", shoes: "", top: "", skirt: "", sleeves: "", belt: "", coat: "", coatSleeves: "", coatW: 16, lines: "", scarf: "", pearls: "", hoops: "", glasses: "", hat: "", strap: "", bag: "" };
  const fill = {};
  const torso = "M 168 104 Q 200 94 232 104 L 224 150 L 216 182 L 224 214 L 176 214 L 184 182 L 176 150 Z";
  const longS = "M 166 108 L 156 170 L 152 226 M 234 108 L 244 170 L 248 226", shortS = "M 166 108 L 161 146 M 234 108 L 239 146";
  const PANTS = { jeans: "M 178 206 L 222 206 L 223 376 L 207 376 L 200 240 L 193 376 L 177 376 Z", wide: "M 176 206 L 224 206 L 232 376 L 205 376 L 200 242 L 195 376 L 168 376 Z", shorts: "M 176 206 L 224 206 L 229 254 L 204 254 L 200 238 L 196 254 L 171 254 Z" };
  const SKIRT = { mini: "M 178 204 L 222 204 L 236 258 L 164 258 Z", midi: "M 178 204 L 222 204 L 242 320 L 158 320 Z", knee: "M 180 180 L 220 180 L 240 290 L 160 290 Z", gown: "M 180 180 L 220 180 L 234 384 L 166 384 Z" };
  const one = L("one", s.one, s.oneC);
  if (one) {
    const c = one.hex;
    fill.top = fill.skirt = fill.bottom = fill.sleeve = c;
    if (one.shape === "swim") a.top = "M 168 104 Q 200 94 232 104 L 224 150 L 216 182 L 224 214 L 200 226 L 176 214 L 184 182 L 176 150 Z";
    else if (one.shape === "jump" || one.shape === "suit") { a.top = torso; a.bottom = PANTS.wide; if (one.shape === "suit") { a.sleeves = longS; a.lines = "M 190 100 L 200 150 L 210 100 M 200 150 L 200 210"; } }
    else { a.top = torso; a.skirt = one.shape === "midi" ? "M 182 180 L 218 180 L 240 322 L 158 322 Z" : one.shape === "mini" ? "M 182 180 L 218 180 L 234 258 L 166 258 Z" : SKIRT[one.shape] || SKIRT.knee; }
  } else {
    const top = L("top", s.top, s.topC), bot = L("bottom", s.bottom, s.bottomC);
    if (top) {
      fill.top = fill.sleeve = top.hex;
      a.top = top.shape === "tank" ? "M 176 106 Q 200 112 224 106 L 224 150 L 216 182 L 224 214 L 176 214 L 184 182 L 176 150 Z" : torso;
      a.sleeves = top.shape === "long" ? longS : top.shape === "short" ? shortS : "";
    }
    if (bot) {
      if (PANTS[bot.shape]) { a.bottom = PANTS[bot.shape]; fill.bottom = bot.hex; } else { a.skirt = SKIRT[bot.shape] || SKIRT.mini; fill.skirt = bot.hex; }
    }
  }
  const out = L("outer", s.outer, s.outerC);
  if (out) {
    const y = out.shape === "long" ? 318 : out.shape === "puffer" ? 204 : 222;
    a.coat = `M 165 103 L 193 99 L 191 ${y} L 159 ${y} Z M 235 103 L 207 99 L 209 ${y} L 241 ${y} Z`;
    a.coatSleeves = "M 166 108 L 155 170 L 151 228 M 234 108 L 245 170 L 249 228"; a.coatW = out.shape === "puffer" ? 22 : 16;
    fill.coat = out.hex;
    a.lines = (a.lines ? a.lines + " " : "") + "M 193 100 L 186 150 M 207 100 L 214 150" + (out.shape === "puffer" ? " M 162 140 L 192 140 M 208 140 L 238 140 M 161 172 L 191 172 M 209 172 L 239 172" : "");
  }
  const sh = L("shoes", s.shoes, s.shoesC);
  if (sh) {
    fill.shoes = sh.hex;
    a.shoes = sh.shape === "bare" ? "" : sh.shape === "knee" ? "M 175 300 L 195 300 L 194 388 L 172 388 Z M 205 300 L 225 300 L 228 388 L 206 388 Z"
      : sh.shape === "ankle" ? "M 174 356 L 194 356 L 194 390 L 170 390 Z M 206 356 L 226 356 L 230 390 L 206 390 Z"
      : "M 172 382 Q 184 374 196 382 L 196 391 L 170 391 Z M 204 382 Q 216 374 228 382 L 230 391 L 204 391 Z";
  }
  for (const k of Array.isArray(s.acc) ? s.acc : []) {
    const it = L("acc", k, ""); if (!it) continue;
    const c = it.hex;
    if (it.shape === "hoops") a.hoops = "M 179 66 a 4 5 0 1 0 0.1 0 M 221 66 a 4 5 0 1 0 0.1 0";
    if (it.shape === "pearls") a.pearls = "M 186 96 Q 200 114 214 96";
    if (it.shape === "glasses") { a.glasses = "M 183 54 h 15 v 8 q -8 3 -15 0 Z M 202 54 h 15 v 8 q -7 3 -15 0 Z M 197 56 h 6 v 2 h -6 Z"; fill.glasses = c; }
    if (it.shape === "cap") { a.hat = "M 182 52 Q 184 32 200 32 Q 216 32 218 52 L 232 54 L 218 56 L 182 56 Z"; fill.hat = c; }
    if (it.shape === "beret") { a.hat = "M 176 48 Q 182 30 202 31 Q 224 33 222 48 Q 200 53 176 48 Z"; fill.hat = c; }
    if (it.shape === "scarf") { a.scarf = "M 184 90 Q 200 104 216 90 L 217 99 Q 200 113 183 99 Z M 206 102 L 214 140 L 205 141 L 200 105 Z"; fill.scarf = c; }
    if (it.shape === "bag") { a.strap = "M 172 104 L 244 196"; a.bag = "M 232 192 h 28 v 22 q 0 3 -3 3 h -22 q -3 0 -3 -3 Z"; fill.bag = c; }
    if (it.shape === "belt") { a.belt = "M 180 178 h 40 v 7 h -40 Z"; fill.belt = c; }
  }
  const F = k => fill[k] || "transparent";
  const P = (d, attrs) => d ? `<path d="${d}" ${attrs}/>` : "";
  const op = on ? 1 : 0.35, body = "#5c5c66";
  const dims = size ? `width="${size}" height="${size * 420 / 400}"` : `width="100%" height="100%"`;
  return `<svg ${aria ? `role="img" aria-label="${String(aria).replace(/"/g, "&quot;")}"` : 'aria-hidden="true"'} ${dims} viewBox="${size ? "120 20 160 380" : "0 0 400 420"}" preserveAspectRatio="xMidYMid meet" style="display:block">
    ${size ? "" : `<rect width="400" height="420" fill="url(#kqo-bg)"/><defs><radialGradient id="kqo-bg" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#1f2030"/><stop offset="0.55" stop-color="#16161b"/><stop offset="1" stop-color="#121215"/></radialGradient></defs>`}
    <ellipse cx="200" cy="392" rx="54" ry="7" fill="#000" opacity="0.4"/>
    <path d="M 190 214 L 186 300 L 184 380 M 210 214 L 214 300 L 216 380" fill="none" stroke="${body}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
    <g opacity="${op}">${P(a.bottom, `fill="${F("bottom")}"`)}${P(a.shoes, `fill="${F("shoes")}"`)}</g>
    <path d="${torso}" fill="${body}"/>
    <path d="M 166 108 L 156 170 L 152 232 M 234 108 L 244 170 L 248 232" fill="none" stroke="${body}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="193" y="78" width="14" height="22" rx="5" fill="${body}"/>
    <ellipse cx="200" cy="60" rx="17" ry="21" fill="${body}"/>
    <g opacity="${op}">
      ${P(a.top, `fill="${F("top")}"`)}${P(a.skirt, `fill="${F("skirt")}"`)}
      ${P(a.sleeves, `fill="none" stroke="${F("sleeve")}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"`)}
      ${P(a.belt, `fill="${F("belt")}"`)}${P(a.coat, `fill="${F("coat")}"`)}
      ${P(a.coatSleeves, `fill="none" stroke="${F("coat")}" stroke-width="${a.coatW}" stroke-linecap="round" stroke-linejoin="round"`)}
      ${P(a.lines, `fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="1.5" stroke-linecap="round"`)}
      ${P(a.scarf, `fill="${F("scarf")}"`)}
      ${P(a.pearls, `fill="none" stroke="#f1ece0" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0.1 5"`)}
      ${P(a.hoops, `fill="none" stroke="#d9b45a" stroke-width="2"`)}
      ${P(a.glasses, `fill="${F("glasses")}"`)}${P(a.hat, `fill="${F("hat")}"`)}
      ${P(a.strap, `fill="none" stroke="${F("bag")}" stroke-width="2.5"`)}${P(a.bag, `fill="${F("bag")}"`)}
    </g></svg>`;
}
