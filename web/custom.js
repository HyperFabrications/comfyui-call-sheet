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
export async function saveCustom(data, { id = "", title = "", text = "" }) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title, text }) });
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
  const frames = data.frames.filter(f => f.tab === "custom").map(({ title, text, added }) => ({ title, text, added }));
  const blob = new Blob([JSON.stringify({ kind: "krea-pose-sheet-custom", version: 1, frames }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `krea-custom-prompts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return frames.length;
}

// Add the prompts from an exported file. Always appends; nothing you have is replaced. Returns how many were added.
export async function importCustom(data, file) {
  let body;
  try { body = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a prompt export."); }
  const r = await fetch("/krea_pose_sheet/custom/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't import");
  for (let i = data.frames.length - 1; i >= 0; i--) if (data.frames[i].tab === "custom") data.frames.splice(i, 1);
  data.frames.push(...j.frames);
  return j.added;
}
