// Your own choices for the Studio: extra options for the person traits, the scene settings and the camera.
// They live in custom_choices.json in the plugin folder on your computer. choices.py mirrors the merging here.
const API = "/krea_pose_sheet/choices";
export const NEUTRAL = "linear-gradient(135deg,#3a3b44,#6b6d7a)";

export async function loadChoices() {
  try { const r = await fetch(API, { cache: "no-store" }); if (!r.ok) return null; return (await r.json()).choices || []; } catch (e) { return null; }
}
export async function saveChoice(c) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save it");
  return j.choice;
}
export async function deleteChoice(id) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete it");
}

const artMedium = n => n ? n[0].toLowerCase() + n.slice(1) : n;

// Put your scene choices into scenes.json's categories (in place, so every builder sees them). Safe to call again.
export function mergeScenes(scenes, choices) {
  if (!scenes) return scenes;
  const mine = (choices || []).filter(c => c.layer === "scene");
  for (const cat of scenes.categories || []) {
    cat.options = cat.options.filter(o => !o.mine).concat(mine.filter(c => c.group === cat.key).map(c => ({ value: c.id, name: c.name, text: c.text, kind: "none", mine: true })));
  }
  return scenes;
}

// Put your cameras, flaws, skin details and looks into cameras.json's lists (in place). Safe to call again.
export function mergeCameras(cams, choices) {
  if (!cams) return cams;
  const mine = (choices || []).filter(c => c.layer === "camera");
  const flaws = mine.filter(c => c.group === "flaws").map(c => ({ key: c.id, name: c.name, text: c.text, on: false, mine: true }));
  cams.cameras = cams.cameras.filter(c => !c.mine).map(c => ({ ...c, flaws: c.flaws.filter(f => !f.mine).concat(flaws) }))
    .concat(mine.filter(c => c.group === "cam").map(c => ({ value: c.id, name: c.name, short: c.text, device: c.text, finish: "", flaws: [...flaws], mine: true })));
  cams.skin = cams.skin.filter(s => !s.mine).concat(mine.filter(c => c.group === "skin").map(c => ({ key: c.id, name: c.name, text: c.text, on: false, mine: true })));
  const looks = (cams.looks || []).filter(l => !l.mine);
  for (const c of mine) {
    if (!c.group.startsWith("look:")) continue;
    const g = c.group.slice(5), art = looks.some(l => l.art && l.group === g);
    looks.push({ value: c.id, name: c.name, short: c.text, group: g, grade: c.text, swatch: NEUTRAL, mine: true, ...(art ? { art: true, medium: artMedium(c.name) } : {}) });
  }
  cams.looks = looks;
  return cams;
}
