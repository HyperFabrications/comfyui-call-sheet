// Cameras: make a frame read like it came from a real device (phone, flash, disposable, film), with that device's flaws,
// and optionally real skin. camera_data.py mirrors these functions for the Python node; keep the two in step
// (tests/camera_parity.mjs checks them).
import { split } from "./scene_core.js";

const CAM = /\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed)\b/i;
const LENS = /\b(\d+\s?mm|lens|phone camera look|deep focus|depth of field|background blur|focus falloff|bokeh)\b/i;
const FIN = /\b(grain|grainy|film|finish|grade|grading|matte|print border)\b/i;
const FLASH = /\bflash\b/i;

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const low = s => s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
const list = a => a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0] || "";
const pick = (items, chosen) => items.filter(o => chosen && typeof chosen[o.key] === "boolean" ? chosen[o.key] : o.on);

export const cameraOf = (cams, value) => value ? cams.cameras.find(c => c.value === value) || null : null;

// Turn the node's picks into what goes into a prompt.
// state: { cam, flaws: {key: bool}, skin: bool, skinBits: {key: bool}, on }
export function parts(cams, state) {
  const st = state || {}, c = cameraOf(cams, st.cam);
  const flaws = c ? pick(c.flaws, st.flaws).map(o => o.text) : [];
  const bits = st.skin ? pick(cams.skin, st.skinBits).map(o => o.text) : [];
  return {
    on: st.on !== false, cam: c ? c.value : "", label: c ? c.name : "",
    device: c ? c.device : "", keepLens: !!(c && c.keepLens), light: c && c.light ? c.light : "", finish: c ? c.finish : "",
    flaws: flaws.length ? cap(list(flaws)) + "." : "",
    skin: st.skin ? (bits.length ? `Natural unretouched skin with ${list(bits)}.` : "Natural unretouched skin.") : "",
  };
}

// The camera on its own, as the lines it adds.
export function cameraText(p) {
  if (!p.on) return "";
  return [p.device ? cap(p.device) + "." : "", p.light, p.finish ? cap(p.finish) + "." : "", p.flaws, p.skin].filter(Boolean).join(" ");
}

// Put the camera into a prompt: its device in the camera line, its flash before the frame's light,
// its finish in place of the frame's grain and film words, then its flaws and the skin line.
export function apply(text, p) {
  const s = split(text);
  if (p.cam) {
    let c = s.findIndex((x, i) => i > 0 && CAM.test(x));
    if (c < 0) { s.push(cap(p.device) + "."); c = s.length - 1; }
    else {
      const bits = s[c].replace(/\.+$/, "").split(/,\s*/).filter(Boolean);
      let at = bits.findIndex(b => LENS.test(b));
      if (at < 0) at = bits.length;
      const kept = p.keepLens ? bits.map(b => b.replace(/^shot on (\d+\s?mm)$/i, "$1 lens")) : bits.filter(b => !LENS.test(b));
      if (!p.keepLens) at = bits.slice(0, at).filter(b => !LENS.test(b)).length;
      if (at === 0 && kept.length) kept[0] = low(kept[0]);
      kept.splice(at, 0, p.device);
      s[c] = cap(kept.join(", ")) + ".";
    }
    let from = c + 1;
    if (p.light && !s.slice(c + 1).some(x => FLASH.test(x))) { s.splice(c + 1, 0, p.light); from = c + 2; }
    let done = false;
    for (let i = from; i < s.length; i++) {
      const bits = s[i].replace(/\.+$/, "").split(/,\s*/).filter(Boolean);
      const at = bits.findIndex(b => FIN.test(b));
      if (at < 0) continue;
      const kept = bits.filter(b => !FIN.test(b));
      if (!done) { kept.splice(bits.slice(0, at).filter(b => !FIN.test(b)).length, 0, p.finish); done = true; }
      if (kept.length) s[i] = cap(kept.join(", ")) + ".";
      else { s.splice(i, 1); i--; }
    }
    if (!done) s.push(cap(p.finish) + ".");
    if (p.flaws) s.push(p.flaws);
  }
  if (p.skin) s.push(p.skin);
  return s.join(" ");
}

// The prompt after the camera. Returns [text, changed].
export function withCamera(text, p) {
  if (!p || !p.on || (!p.cam && !p.skin)) return [text, false];
  return [apply(text, p), true];
}
