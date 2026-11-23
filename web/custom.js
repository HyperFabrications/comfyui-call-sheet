// Your own prompts (the Custom tab). They live in custom_prompts.json in the plugin folder on your computer,
// so the node can use them, and they are never part of the repo.
const API = "/krea_pose_sheet/custom";

// Add the Custom tab and your prompts to the loaded sheet data. Returns false where there is no ComfyUI server.
export async function mergeCustom(data) {
  let j;
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) return false;
    j = await r.json();
  } catch (e) { return false; }
  if (!data.tabs.some(t => t.id === "custom")) data.tabs.push(j.tab);
  data.sets.custom = j.setName;
  for (let i = data.frames.length - 1; i >= 0; i--) if (data.frames[i].tab === "custom") data.frames.splice(i, 1);
  data.frames.push(...j.frames);
  data.hasCustom = true;
  return true;
}

// Save a new prompt (no id) or update one. Keeps data.frames in step and returns the saved frame.
export async function saveCustom(data, { id = "", title = "", text = "", portable }) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title, text, portable }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save the prompt");
  const f = j.frame, i = data.frames.findIndex(x => x.id === f.id);
  if (i >= 0) Object.assign(data.frames[i], f); else data.frames.push(f);
  return i >= 0 ? data.frames[i] : f;
}

export async function deleteCustom(data, id) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete the prompt");
  const i = data.frames.findIndex(x => x.id === id);
  if (i >= 0) data.frames.splice(i, 1);
}

// Download your custom prompts as a file you can keep or share.
export function exportCustom(data) {
  const frames = data.frames.filter(f => f.tab === "custom").map(({ title, text, added, portable }) => ({ title, text, added, portable: !!portable }));
  const blob = new Blob([JSON.stringify({ kind: "krea-pose-sheet-custom", version: 1, frames }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `krea-custom-prompts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return frames.length;
}

// Add the prompts from an exported file (.json) or a text list (.txt). Always appends; nothing you have is replaced.
// Returns { added, skipped }.
export async function importCustom(data, file) {
  const raw = await file.text();
  if (/\.json$/i.test(file.name) || /^\s*[[{]/.test(raw)) {
    let body;
    try { body = JSON.parse(raw); } catch (e) { throw new Error("That file isn't a prompt export."); }
    return postImport(data, body);
  }
  const items = parsePromptList(raw);
  if (!items.length) throw new Error("No prompts found in that file.");
  return postImport(data, items);
}

// Add a list of { title, text } as new prompts. Prompts you already have are skipped.
export const importList = (data, items, portable = false) => postImport(data, items.map(x => ({ ...x, portable })));

async function postImport(data, body) {
  const r = await fetch(API + "/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't import");
  for (let i = data.frames.length - 1; i >= 0; i--) if (data.frames[i].tab === "custom") data.frames.splice(i, 1);
  data.frames.push(...j.frames);
  return { added: j.added, skipped: j.skipped || 0 };
}

// A pasted list of prompts, one per line. A line that stops mid-sentence carries on into the next one. A short line
// with no full stop right before a prompt is its name. Bullets, numbers and quotes are dropped.
const SUBJECT = /^(?:a|an)\s+(?:[\w-]+\s+){0,3}?(?:woman|man|girl|boy|guy|person|model|lady)\b/i;
export function parsePromptList(raw) {
  const clean = l => l.replace(/^\s*(?:[-*\u2022]|\d{1,3}[.):])\s+/, "").trim().replace(/^["\u201c\u2018'](.*)["\u201d\u2019']$/, "$1").trim();
  const lines = String(raw || "").replace(/\r\n?/g, "\n").split("\n").map(clean);
  const isName = l => l.split(/\s+/).length < 8 && !/[.!?"\u201d]$/.test(l) && !/\[trigger\]/.test(l);
  const out = [];
  let name = "", buf = "";
  const flush = () => {
    if (buf) out.push({ title: (name || titleFor(buf)).slice(0, 80), text: withTrigger(buf) });
    else if (name) out.push(null); // a name with nothing after it was a heading
    buf = ""; name = "";
  };
  for (const l of lines) {
    if (!l) { if (buf) flush(); continue; }
    if (buf && !/[.!?"\u201d]$/.test(buf)) { buf += " " + l; continue; }
    if (buf) flush();
    if (isName(l)) name = l; else buf = l;
  }
  if (buf) flush();
  return out.filter(Boolean);
}

// Make sure the prompt has a [trigger]: "A young woman sitting…" becomes "[trigger] sitting…".
export function withTrigger(t) {
  if (/\[trigger\]/.test(t)) return t;
  return SUBJECT.test(t) ? t.replace(SUBJECT, "[trigger]") : "[trigger] " + (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
}

// A short name from the prompt: the pose after the opening "[trigger] in a … photo," part.
const TAIL = /^(with|the|a|an|and|of|in|on|at|to|her|his|their|by|from|into|while|as|for)$/i;
export function titleFor(text) {
  const first = text.split(/(?<=\.)\s/)[0].replace(/\[trigger\]\s*,?\s*/g, "").replace(SUBJECT, "").trim();
  const parts = first.split(/,\s*/).filter(Boolean);
  let c = parts.length > 1 && /^in an?\b/i.test(parts[0]) ? parts[1] : parts[0] || "";
  let w = c.replace(/\.$/, "").split(/\s+/).filter(Boolean).slice(0, 6);
  while (w.length > 1 && TAIL.test(w[w.length - 1])) w.pop();
  const s = w.join(" ");
  return s ? s[0].toUpperCase() + s.slice(1) : "Untitled";
}
