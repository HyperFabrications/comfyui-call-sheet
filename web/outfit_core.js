// Outfits: swap what she's wearing in a frame, either the whole outfit or only the pieces you pick.
// outfit_data.py mirrors these functions for the Python nodes; keep the two in step (tests/outfit_parity.mjs checks them).
import { split } from "./scene_core.js";

export const WEARING = /^(wearing|she wears|she is wearing)\b/i;
export const SLOTS = ["outer", "one", "top", "bottom", "legs", "shoes", "acc", "face"];
// What each piece of a frame's clothing line is. The first match wins, so the order matters.
const KINDS = [
  ["shoes", /\b(shoes|boots?|heels|sneakers|trainers|loafers|sandals|mules|pumps|flats|slippers|stilettos|espadrilles|clogs|oxfords|feet|platforms)\b/i],
  ["legs", /\b(tights|stockings|socks|leg warmers|thigh highs|garters?|hosiery|fishnets)\b/i],
  ["one", /\b(dress|sundress|gown|jumpsuit|romper|playsuit|bodysuit|swimsuit|bikini|leotard|catsuit|overalls|coveralls|suit|slip|kimono|robe|teddy|babydoll|nightgown|chemise)\b/i],
  ["outer", /\b(coat|peacoat|raincoat|overcoat|jacket|bomber|blazer|cardigan|parka|puffer|trench|shawl|cape|poncho|gilet|shacket|overshirt)\b/i],
  ["bottom", /\b(jeans|trousers|pants|skirt|shorts|leggings|joggers|sweatpants|culottes|slacks|chinos|bottoms|panties|briefs|thong|knickers|underwear|boyshorts)\b/i],
  ["top", /\b(tee|t-shirt|shirt|blouse|tank|sweater|jumper|turtleneck|hoodie|sweatshirt|top|camisole|cami|bralette|bra|corset|bustier|henley|polo|halter|bandeau|pullover|vest)\b/i],
  ["acc", /\b(earrings?|necklace|choker|pendant|bracelets?|bangles?|watch|rings?|bag|purse|clutch|tote|backpack|belt|hat|cap|beret|beanie|scarf|bandana|headband|sunglasses|glasses|eyeglasses|gloves|clip|barrette|ribbon|bow|anklet|pearls|hoops|tiara|jewelry|apron|earbuds|headphones)\b/i],
  ["face", /\b(lips|lipstick|gloss|blush|eyeliner|mascara|makeup|nails|manicure|polish|freckles|eyeshadow|lashes|brows|bronzer|highlighter|tattoos?|piercings?)\b/i],
];
export const kindOf = s => { for (const [k, re] of KINDS) if (re.test(s)) return k; return ""; };

// The frame's clothing line, split into pieces: [{ slot, text }].
export function pieces(line) {
  const body = line.replace(WEARING, "").replace(/^[\s,]+/, "").replace(/[\s.]+$/, "");
  const out = [];
  const push = t => { t = t.trim(); if (t) out.push({ slot: kindOf(t), text: t }); };
  for (const chunk of body.split(/,\s*/)) {
    const c = chunk.replace(/^and\s+/, ""), ov = c.split(/\s+over\s+/);
    for (const part0 of ov.length > 1 && ov.every(b => kindOf(b)) ? ov : [c]) {
      // Split on "and" between pieces. A bit that names no piece ("a black", "dangling starfish") joins the next one, or the last.
      const got = [];
      let carry = "";
      for (const b of part0.split(/\s+and\s+/)) {
        const cur = carry ? carry + " and " + b : b;
        if (kindOf(b)) { got.push(cur); carry = ""; } else carry = cur;
      }
      if (carry) { if (got.length) got[got.length - 1] += " and " + carry; else got.push(carry); }
      got.forEach(push);
    }
  }
  // A piece with no kind belongs to the one before it.
  for (let i = 1; i < out.length; i++) if (!out[i].slot) out[i].slot = out[i - 1].slot;
  if (out.length && !out[0].slot) out[0].slot = "top";
  return out;
}

const list = a => a.length === 1 ? a[0] : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
// Pieces back into one sentence: outerwear goes over the top or the one piece.
export function compose(ps) {
  const by = k => ps.filter(p => p.slot === k).map(p => p.text);
  const outer = by("outer"), body = [...by("one"), ...by("top")];
  const words = [];
  if (outer.length && body.length) { words.push(outer.join(" and ") + " over " + body[0]); words.push(...body.slice(1)); }
  else words.push(...outer, ...body);
  for (const k of ["bottom", "legs", "shoes", "acc", "face"]) words.push(...by(k));
  return words.length ? "Wearing " + list(words) + "." : "";
}

const an = s => s.replace(/^a (?=[aeiou])/i, "an ");
const option = (outfits, cat, value) => {
  const c = outfits.categories.find(x => x.key === cat);
  return c && value ? c.options.find(o => o.value === value) || null : null;
};
export function phrase(outfits, cat, value, color, items = []) {
  const mine = items.find(x => x.id === value);
  if (mine) return mine.text;
  const o = option(outfits, cat, value);
  if (!o) return "";
  const c = outfits.colors.find(x => x.value === (color || o.color));
  return an(o.text.replace("{c}", c ? c.word : "").replace(/\s+/g, " ").trim());
}

// Turn the builder's picks into pieces. state: { top, topC, bottom, bottomC, one, oneC, outer, outerC, shoes, shoesC, acc: [], swap, on }
export function parts(outfits, state, items = []) {
  const st = state || {}, out = [];
  const add = (slot, value, color) => { const t = phrase(outfits, slot, value, color, items); if (t) out.push({ slot, text: t }); };
  if (st.one) add("one", st.one, st.oneC); else { add("top", st.top, st.topC); add("bottom", st.bottom, st.bottomC); }
  add("outer", st.outer, st.outerC);
  add("shoes", st.shoes, st.shoesC);
  for (const a of Array.isArray(st.acc) ? st.acc : []) add("acc", a, "");
  const has = k => out.some(p => p.slot === k);
  return { pieces: out, swap: st.swap === "pick" ? "pick" : "whole", on: st.on !== false, dressed: has("one") || (has("top") && has("bottom")) };
}

// The outfit on its own, as a clothing line.
export const outfitText = p => compose(p.pieces);

// What the frame wears after the outfit: everything (keeping makeup), or only the picked pieces.
export function merge(frame, p) {
  if (p.swap !== "pick") return [...p.pieces, ...frame.filter(x => x.slot === "face")];
  const picked = new Set(p.pieces.map(x => x.slot));
  const drop = new Set();
  if (picked.has("one")) ["one", "top", "bottom"].forEach(k => drop.add(k));
  if (picked.has("top")) ["top", "one"].forEach(k => drop.add(k));
  if (picked.has("bottom")) ["bottom", "one"].forEach(k => drop.add(k));
  for (const k of ["outer", "shoes"]) if (picked.has(k)) drop.add(k);
  return [...frame.filter(x => !drop.has(x.slot)), ...p.pieces];
}

// Swap the frame's clothing line. A frame with no clothing line gets one after the pose.
export function apply(text, p) {
  if (!p.pieces.length) return text;
  const s = split(text);
  const i = s.findIndex((x, j) => j >= 1 && WEARING.test(x));
  const line = compose(merge(i >= 0 ? pieces(s[i]) : [], p));
  if (i >= 0) s[i] = line; else s.splice(Math.min(1, s.length), 0, line);
  return s.join(" ");
}

// Frames whose pose relies on a garment keep their own clothes unless you chose to use the outfit anyway.
// Your own prompts work with outfits when they have a "Wearing" line.
export function locked(outfits, frame, overrides = []) {
  if (overrides.includes(frame.id)) return false;
  if (frame.tab === "custom") return !split(frame.text).some((x, j) => j >= 1 && WEARING.test(x));
  const v = outfits.frames[frame.id];
  return v === undefined || v !== "";
}
export const garmentOf = (outfits, frame) => frame.tab === "custom" ? "clothes described in its own words" : outfits.frames[frame.id] || "its own clothes";

// The frame's text after the outfit. Returns [text, changed].
export function withOutfit(outfits, frame, p, overrides = []) {
  if (!p || p.on === false || !p.pieces.length) return [frame.text, false];
  if (locked(outfits, frame, overrides)) return [frame.text, false];
  const t = apply(frame.text, p);
  return [t, t !== frame.text];
}
