// Cameras and looks: make a frame read like it came from a real device (phone, flash, disposable, film) with that
// device's flaws, give it a look (a film stock, a grade, a kind of light) or turn it into art (anime, watercolor, oil),
// and optionally add real skin. camera_data.py mirrors these functions for the Python node; keep the two in step
// (tests/camera_parity.mjs checks them).
import { split } from "./scene_core.js";

const CAM = /\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed)\b/i;
const LENS = /\b(\d+\s?mm|lens|phone camera look|deep focus|depth of field|background blur|focus falloff|bokeh)\b/i;
const FIN = /\b(grain|grainy|film|finish|grade|grading|matte|print border)\b/i;
const FLASH = /\bflash\b/i;
const LIGHTW = /\b(light|lights|daylight|lit|lighting|flash|glow|glowing|sunlight|sun|shadow|shadows|backlit|backlight|lamp|lamps|neon|candlelight|highlights|overcast|sky|rim)\b/i;
const PAL = /\b(palette|tones|colou?rs?|monochrome|black and white|sepia)\b/i;
const REAL = /\b(photo|photograph|photographic|photorealistic|realistic|real|skin texture)\b/i;
// Words that make the opening phrase a photo; an art style keeps what comes before them ("storybook autumn").
const PHOTO_NOUN = /\b(photos?|photographs?|portraits?|shoot|snapshots?|selfies?|self|camera|pictures?|image|still|shot|mirror|phone)\b/i;

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const low = s => s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
const list = a => a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0] || "";
const pick = (items, chosen) => items.filter(o => chosen && typeof chosen[o.key] === "boolean" ? chosen[o.key] : o.on);

export const cameraOf = (cams, value) => value ? cams.cameras.find(c => c.value === value) || null : null;
export const lookOf = (cams, value) => value && cams.looks ? cams.looks.find(l => l.value === value) || null : null;

// Turn the node's picks into what goes into a prompt. An art style sets its own medium, so it drops the camera and skin.
// state: { cam, look, flaws: {key: bool}, skin: bool, skinBits: {key: bool}, on }
export function parts(cams, state) {
  const st = state || {}, l = lookOf(cams, st.look), art = !!(l && l.art), c = art ? null : cameraOf(cams, st.cam);
  const flaws = c ? pick(c.flaws, st.flaws).map(o => o.text) : [];
  const skin = !!st.skin && !art;
  const bits = skin ? pick(cams.skin, st.skinBits).map(o => o.text) : [];
  return {
    on: st.on !== false, cam: c ? c.value : "", label: c ? c.name : "",
    device: c ? c.device : "", keepLens: !!(c && c.keepLens), light: c && c.light ? c.light : "", finish: c ? c.finish : "",
    flaws: flaws.length ? cap(list(flaws)) + "." : "",
    look: l ? l.value : "", lookLabel: l ? l.name : "", art, medium: art ? l.medium : "",
    lookLight: l && l.light ? l.light : "", grade: l ? l.grade : "", frame: l && l.frame ? l.frame : "",
    skin: skin ? (bits.length ? `Natural unretouched skin with ${list(bits)}.` : "Natural unretouched skin.") : "",
  };
}

// What the node card and the picker call it.
export const labelOf = p => [p.label, p.lookLabel].filter(Boolean).join(" · ") || (p.skin ? "Real skin" : "");

// The camera on its own, as the lines it adds.
export function cameraText(p) {
  if (!p.on) return "";
  if (p.art) return cap(article(p.medium)) + ". " + cap(p.grade) + ".";
  const dev = [p.device, p.frame].filter(Boolean).join(", ");
  return [dev ? cap(dev) + "." : "", p.light, p.lookLight, p.grade ? cap(p.grade) + "." : "", p.finish ? cap(p.finish) + "." : "", p.flaws, p.skin].filter(Boolean).join(" ");
}

const article = m => (/^[aeiou]/i.test(m) ? "an " : "a ") + m;

// Photo words that don't carry over to art ("black and white", "close", "model test"), and words the medium already says.
const NOT_ART = /\b(black and white|monochrome|close|detail|high key|low key|model|digitals|test|lookbook|campaign|overhead|wide|beauty)\b/gi;
function tidyLead(keep, medium) {
  const said = new Set(medium.toLowerCase().replace(/-/g, " ").split(/\s+/));
  return keep.replace(NOT_ART, " ").split(/\s+/).filter(w => w && !w.toLowerCase().replace(/-/g, " ").split(" ").every(x => said.has(x))).join(" ");
}

// The opening phrase as art: "[trigger] in a storybook autumn photo," becomes "[trigger] in a storybook autumn watercolor illustration,".
function artLead(first, medium) {
  const m = first.match(/^\[trigger\] in an? ([^,]*?)(?=,)/);
  if (m) {
    const i = m[1].search(PHOTO_NOUN);
    const keep = tidyLead(i < 0 ? "" : m[1].slice(0, i), medium);
    return "[trigger] in " + article((keep ? keep + " " : "") + medium) + first.slice(m[0].length);
  }
  if (/^\[trigger\]\s/.test(first)) return "[trigger] in " + article(medium) + "," + first.slice(9);
  return null;
}

const bitsOf = x => x.replace(/\.+$/, "").split(/,\s*/).filter(Boolean);

// Drop the bits that pass test from sentences after c (never the protected ones), and put add where the first one was.
function swap(s, c, prot, test, add) {
  let done = !add;
  for (let i = c + 1; i < s.length; i++) {
    const bits = bitsOf(s[i]);
    const hit = b => !prot.has(b) && test(b);
    const at = bits.findIndex(hit);
    if (at < 0) continue;
    const kept = bits.filter(b => !hit(b));
    if (!done) { kept.splice(bits.slice(0, at).filter(b => !hit(b)).length, 0, add); done = true; }
    if (kept.length) s[i] = cap(kept.join(", ")) + ".";
    else { s.splice(i, 1); i--; }
  }
  return done;
}

// Put the camera and look into a prompt: the device (and look framing) in the camera line, the flash and the look's light
// after it, the look's grade in place of the frame's palette, the camera's finish in place of its grain and film words,
// then the flaws and the skin line.
export function apply(text, p) {
  const s = split(text), prot = new Set();
  const guard = t => { for (const b of bitsOf(t)) prot.add(b); };
  if (p.art) {
    const lead = s.length ? artLead(s[0], p.medium) : null;
    if (lead) s[0] = lead; else s.unshift(cap(article(p.medium)) + ".");
    // Paintings have no lens: keep the framing, drop lens and focus words. Palette, film and photo words make way for the style.
    let from = s.findIndex((x, i) => i > 0 && CAM.test(x));
    if (from > 0) {
      const kept = bitsOf(s[from]).filter(b => !LENS.test(b));
      if (kept.length) s[from] = cap(kept.join(", ")) + "."; else { s.splice(from, 1); from--; }
    } else from = 0;
    if (!swap(s, from, prot, b => PAL.test(b) || FIN.test(b) || REAL.test(b), p.grade)) s.push(cap(p.grade) + ".");
    return s.join(" ");
  }
  if (p.cam || p.look) {
    let c = s.findIndex((x, i) => i > 0 && CAM.test(x));
    const extra = [p.device, p.frame].filter(Boolean);
    if (c < 0) { if (extra.length) { s.push(cap(extra.join(", ")) + "."); c = s.length - 1; } else c = s.length - 1; }
    else if (extra.length) {
      const bits = bitsOf(s[c]);
      let kept = bits, at = bits.length;
      if (p.cam) {
        at = bits.findIndex(b => LENS.test(b));
        if (at < 0) at = bits.length;
        kept = p.keepLens ? bits.map(b => b.replace(/^shot on (\d+\s?mm)$/i, "$1 lens")) : bits.filter(b => !LENS.test(b));
        if (!p.keepLens) at = bits.slice(0, at).filter(b => !LENS.test(b)).length;
        if (at === 0 && kept.length) kept[0] = low(kept[0]);
        kept.splice(at, 0, p.device);
      }
      if (p.frame) kept.push(p.frame);
      s[c] = cap(kept.join(", ")) + ".";
    }
    let at = c + 1;
    if (p.light && !s.slice(c + 1).some(x => FLASH.test(x))) { s.splice(at, 0, p.light); guard(p.light); at++; }
    if (p.lookLight) {
      swap(s, c, prot, b => LIGHTW.test(b) && !PAL.test(b), "");
      s.splice(at, 0, p.lookLight); guard(p.lookLight);
    }
    if (p.grade) {
      if (!swap(s, c, prot, b => PAL.test(b) || (!p.cam && FIN.test(b)), p.grade)) s.push(cap(p.grade) + ".");
      guard(p.grade);
    }
    if (p.cam && !swap(s, c, prot, b => FIN.test(b), p.finish)) s.push(cap(p.finish) + ".");
    if (p.flaws) s.push(p.flaws);
  }
  if (p.skin) s.push(p.skin);
  return s.join(" ");
}

// The prompt after the camera. Returns [text, changed].
export function withCamera(text, p) {
  if (!p || !p.on || (!p.cam && !p.look && !p.skin)) return [text, false];
  return [apply(text, p), true];
}
