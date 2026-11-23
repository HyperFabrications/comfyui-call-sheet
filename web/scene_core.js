// Scenes: swap a frame's setting for one you build, or make a clean plate with nobody in it.
// scene_data.py mirrors these functions for the Python nodes; keep the two in step (tests/parity.mjs checks them).

const CAM = /\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed)\b/i;
const LIGHT = /\b(light|lights|daylight|lit|lighting|flash|glow|glowing|sunlight|sun|shadow|shadows|backlit|backlight|lamp|lamps|neon|candlelight|highlights|fill)\b/i;
const FINISH = /\b(palette|finish|grain|film|tones|contrast)\b/i;
const WEARING = /^(wearing|she wears|she is wearing)\b/i;
const PERSONAL = /\b(her|she|hers|herself|his|him|he|face|skin|body|subject)\b/i;
const FRAMING = /\b(shot|close[- ]?up|crop|cropped|framing|framed|negative space|full length)\b/i;
export const PLATE_END = "No people anywhere in the frame.";

export const split = text => (text.match(/[^.]+(?:\.|$)/g) || []).map(s => s.trim()).filter(Boolean);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

export function layout(s) {
  let c = s.length;
  for (let i = 1; i < s.length; i++) if (CAM.test(s[i])) { c = i; break; }
  const setting = [];
  for (let i = 1; i < c; i++) if (!WEARING.test(s[i])) setting.push(i);
  let light = -1;
  for (let i = c + 1; i < s.length; i++) if (LIGHT.test(s[i]) && !FINISH.test(s[i])) { light = i; break; }
  return [c, setting, light];
}

export const settingOf = text => { const s = split(text); return layout(s)[1].map(i => s[i]).join(" "); };
export const lightOf = text => { const s = split(text), li = layout(s)[2]; return li >= 0 ? s[li] : ""; };

// The Places prompts' settings, plus your own places.
export function places(scenes, frames, customPlaces = []) {
  const name = scenes.placesSet || "Places";
  const out = frames.filter(f => f.set === name).map(f => {
    const light = lightOf(f.text);
    return { id: f.id, title: f.title, bg: settingOf(f.text), light: PERSONAL.test(light) ? "" : light, mine: false };
  });
  for (const p of customPlaces) out.push({ id: p.id, title: p.title, bg: p.bg, light: p.light || "", mine: true });
  return out.filter(p => p.bg);
}

const opt = (scenes, key, value) => {
  if (!value) return null;
  const c = scenes.categories.find(x => x.key === key);
  return c ? c.options.find(o => o.value === value) || null : null;
};

// Turn the builder's picks into the lines that go into a prompt.
export function parts(scenes, state, placeList = []) {
  const st = state || {}, g = k => opt(scenes, k, st[k]);
  const place = st.place ? placeList.find(p => p.id === st.place) || null : null;
  const loc = g("location"), time = g("time"), weather = g("weather"), lighting = g("lighting"), era = g("era"), mood = g("mood");
  const tw = [time, weather].filter(Boolean).map(o => o.text).join(", ");
  let bg = "";
  if (place) bg = place.bg.replace(/[ .]+$/, "") + (tw ? ", " + tw : "") + ".";
  else if (loc) bg = cap(loc.text) + (tw ? ", " + tw : "") + ".";
  const extra = [];
  if (!bg && tw) extra.push(cap(tw) + ".");
  for (const o of [era, mood]) if (o) extra.push(o.text);
  const light = lighting ? lighting.text : (place && place.light ? place.light : "");
  return { bg, extra: extra.join(" "), light, plate: !!st.plate, on: st.on !== false, label: place ? place.title : loc ? loc.name : "" };
}

// The scene on its own: the setting lines, or a whole clean plate prompt.
export function sceneText(p) {
  const body = [p.bg, p.extra, p.light].filter(Boolean).join(" ");
  if (p.plate) return "A photograph of an empty scene with no people." + (body ? " " + body : "") + " " + PLATE_END;
  return body;
}

// Swap the frame's setting (and light line, if one was picked) for the scene's.
export function apply(text, p) {
  const s = split(text);
  let [c, setting] = layout(s);
  if (p.bg) {
    const neu = p.bg + (p.extra ? " " + p.extra : "");
    if (setting.length) { s[setting[0]] = neu; for (const i of setting.slice(1).reverse()) s.splice(i, 1); }
    else s.splice(c, 0, neu);
  } else if (p.extra) {
    s.splice(setting.length ? setting[setting.length - 1] + 1 : c, 0, p.extra);
  }
  if (p.light) {
    const [c2, , li] = layout(s);
    if (li >= 0) s[li] = p.light; else s.splice(Math.min(c2 + 1, s.length), 0, p.light);
  }
  return s.join(" ");
}

// The same frame as an empty scene: its look and camera, with nobody in it.
export function plate(text, p = null) {
  const s = split(text);
  const [c, setting, li] = layout(s);
  const m = s.length ? s[0].match(/^\[trigger\],? (?:in )?(an? [^,]*?),/) : null;
  let lead = m ? m[1].replace(/\b(?:(?:mirror |phone )?selfie|portrait|photo shoot)\b/g, "photograph") : "a photograph";
  if (!/\b(photograph|photo|shot|image|still|frame)\b/.test(lead)) lead += " photograph";
  const out = [cap(lead) + " of an empty scene with no people."];
  if (p && p.bg) { out.push(p.bg); if (p.extra) out.push(p.extra); }
  else {
    for (const i of setting) out.push(s[i].replace(/\s+(?:behind|around|beside|near|under|above|over|in front of) (?:her|him)\b/g, ""));
    if (p && p.extra) out.push(p.extra);
  }
  if (c < s.length) {
    const keep = s[c].replace(/\.+$/, "").split(/,\s*/).filter(x => x && !FRAMING.test(x) && !PERSONAL.test(x));
    if (keep.length) out.push(cap(keep.join(", ")) + ".");
  }
  const light = p && p.light ? p.light : li >= 0 ? s[li] : "";
  if (light) {
    const keep = light.replace(/\.+$/, "").split(/,\s*/).filter(x => x && !PERSONAL.test(x));
    if (keep.length) out.push(cap(keep.join(", ")) + ".");
  }
  for (let i = c + 1; i < s.length; i++) if (i !== li && FINISH.test(s[i]) && !PERSONAL.test(s[i])) out.push(s[i]);
  out.push(PLATE_END);
  return out.join(" ");
}

// Location-bound frames keep their own setting unless you chose to use the scene anyway.
export function locked(scenes, frame, overrides = []) {
  if (overrides.includes(frame.id)) return false;
  if (frame.tab === "custom") return !frame.portable;
  const v = scenes.frames[frame.id];
  return v === undefined || v !== "";
}
// What the pose relies on, for the note on a locked frame.
export const propOf = (scenes, frame) => frame.tab === "custom" ? "something in its own setting" : scenes.frames[frame.id] || "its own setting";

// The frame's text after the scene: swapped setting, a clean plate, or untouched. Returns [text, changed].
export function withScene(scenes, frame, p, overrides = []) {
  if (!p || p.on === false) return [frame.text, false];
  const lock = locked(scenes, frame, overrides);
  if (p.plate) return [plate(frame.text, lock ? null : p), true];
  if (lock) return [frame.text, false];
  return [apply(frame.text, p), true];
}
