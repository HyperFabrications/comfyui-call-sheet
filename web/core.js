// Shared prompt logic for the Krea Pose Sheet (ComfyUI sidebar and web page).
// nodes/pose_data.py mirrors these functions for the Python node; keep them in step.

const STYLE_RE = /\b(grain|grainy|palette|tones|finish|film|matte|contrast|desaturated|saturated|color grade|grading|print border|monochrome|black and white|halftone)\b|\bcolou?r$/i;
const COLOR_END = /\b(greens|browns|whites|blues|pinks|reds|tans|golds|creams|grays|greys|blacks|ambers|yellows|oranges|purples|neutrals|pastels|accents|ivories|coppers)$/i;
const LIGHTY = /\b(light|lights|sun|sunlight|lamp|flash|shadow|shadows|sky|window|glow|neon|highlights)\b/i;
const COLOR_WORD = /^(amber|charcoal|evergreen|ivory|cream|rust|navy|sage|stone|olive|honey|gold|golden|blush|peach|burgundy|emerald|slate|oatmeal|mint|copper|tawny|white|black|gray|grey|brown|pink|red|blue|green)$/i;

// Remove medium, film, grain and palette words so a style or character LoRA supplies the look.
export function stripStyle(t) {
  const lead = t.match(/^\[trigger\] in an? ([^,]*?)(?=,)/);
  if (lead) {
    const L = lead[1];
    let rep;
    if (/selfie/.test(L)) rep = "[trigger] in a " + L.replace(/^.*?((?:mirror |phone )?selfie)/, "$1");
    else if (/implied nude/.test(L)) rep = "[trigger], implied nude";
    else if (/\b(photograph|photo|portrait|shot)\b/.test(L)) rep = "[trigger]";
    if (rep) t = rep + t.slice(lead[0].length);
  }
  const sentences = t.match(/[^.]+(?:\.|$)/g) || [t];
  const out = [];
  for (const s of sentences) {
    const end = s.trim().endsWith(".") ? "." : "";
    const body = s.trim().replace(/\.$/, "");
    if (!body) continue;
    const parts = body.split(/,\s*/);
    const keep = parts.map(p => !(STYLE_RE.test(p) || (COLOR_END.test(p.trim()) && !LIGHTY.test(p))));
    for (let i = parts.length - 2; i >= 0; i--) if (!keep[i + 1] && COLOR_WORD.test(parts[i].trim())) keep[i] = false;
    const kept = parts.filter((_, i) => keep[i]);
    if (!kept.length) continue;
    let k = kept.join(", ");
    if (k[0] === k[0].toLowerCase() && out.length === 0 && !k.startsWith("[")) k = k[0].toUpperCase() + k.slice(1);
    out.push(k + end);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// Build a plain-language person description from Build a person picks ({gender, body, ...}).
export function personText(person) {
  const p = k => person[k] || "";
  if (!Object.values(person).some(Boolean)) return "";
  const g = p("gender"), age = p("age"), decade = age === "thirties" || age === "forties";
  const pron = g === "woman" ? "her" : g === "man" ? "his" : "their";
  const lead = [p("height"), age && !decade ? age : "adult", g || "person"].filter(Boolean).join(" ") + (decade ? ` in ${pron} ${age}` : "");
  const art = /^[aeiou]/i.test(lead) ? "an" : "a";
  const bits = [];
  if (p("body")) bits.push(`${/^[aeiou]/i.test(p("body")) ? "an" : "a"} ${p("body")} build`);
  const hair = [p("length"), p("htype"), p("hcolor")].filter(Boolean).join(" ");
  if (hair || p("length") === "shaved") bits.push(p("length") === "shaved" ? "a shaved head" : `${hair} hair`);
  if (p("eyes")) bits.push(`${p("eyes")} eyes`);
  if (p("skin") || p("complexion")) bits.push(`${p("complexion") ? p("complexion") + " " : ""}${p("skin") ? p("skin") + " " : ""}skin`.replace(/,\s/, " ").replace(/\s+/g, " ").trim());
  const list = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0];
  return `${art} ${lead}${list ? " with " + list : ""}`;
}

// What replaces [trigger]: the trigger, the person, or both (trigger stays first so a LoRA leads).
export function subject(trigger, personDesc) {
  const t = (trigger || "").trim(), d = personDesc || "";
  if (!d) return t || "[trigger]";
  return t ? `${t}, ${d},` : d;
}

export const base = (frame, styleOn) => styleOn ? frame.text : (frame.bare || stripStyle(frame.text));

export function fill(text, subj) {
  return text.replace(/\[trigger\](,?)/g, (m, c) => subj.endsWith(",") ? subj : subj + c);
}

// Your own wording for a frame replaces the sheet's text (edits: { frameId: text }).
export const withEdit = (frame, edits) => edits && typeof edits[frame.id] === "string" && edits[frame.id].trim()
  ? { ...frame, text: edits[frame.id], bare: undefined } : frame;

export function promptFor(frame, { trigger = "", person = "", style = true, edits = null } = {}) {
  return fill(base(withEdit(frame, edits), style), subject(trigger, person));
}

export function loadEdits() {
  try { return JSON.parse(localStorage.getItem("kps:edits") || "{}") || {}; } catch (e) { return {}; }
}
export function saveEdit(id, text) {
  const e = loadEdits();
  if (text && text.trim()) e[id] = text; else delete e[id];
  try { localStorage.setItem("kps:edits", JSON.stringify(e)); } catch (err) {}
  return e;
}

export const frameNo = id => /^[A-Z]/.test(id) ? id[0] + id.slice(1).padStart(2, "0") : id.padStart(2, "0");

// The value the Python node's frame dropdown uses for a frame.
export const frameKey = f => `${f.id} · ${f.title}`;

export async function loadData(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
  return r.json();
}
