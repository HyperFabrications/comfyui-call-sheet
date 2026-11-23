// The Studio: one full-screen editor for the whole shot. Tabs for Frame, Person, Outfit, Scene and Camera across the
// top; in each, the groups are listed on the left with what each is set to, the choices fill the middle, and a
// preview stays on the right. The finished prompt runs along the bottom, underlined by the layer that wrote each part.
// openStudio({ env, ctx, tab }). Changes apply as you make them (ctx.save(state)).
import { promptFor, withEdit, personText, frameNo } from "./core.js";
import { withOutfit, outfitText, parts as outfitParts, locked as outfitLocked, garmentOf } from "./outfit_core.js";
import { withScene, parts as sceneParts, locked as sceneLocked, propOf } from "./scene_core.js";
import { parts as camParts, labelOf as camLabel } from "./camera_core.js";
import { traitOrder, shortPerson } from "./builder.js";
import { SWATCH, figureSVG } from "./figure.js";
import { outfitSVG } from "./outfit_art.js";
import { sceneSVG, kindOf, timeOf } from "./scene_art.js";
import { cameraIcon } from "./camera.js";
import { thumbHTML, snippet } from "./gallery.js";
import { parsePromptList } from "./custom.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const ICON = {
  back: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
  gear: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
  link: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
  lock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
};
export const LAYERS = [
  { key: "frame", label: "Frame" },
  { key: "person", label: "Person" },
  { key: "outfit", label: "Outfit" },
  { key: "scene", label: "Scene" },
  { key: "camera", label: "Camera" },
];
const NODE_NAME = { person: "Person node", outfit: "Outfit node", scene: "Scene node", camera: "Camera node" };

// ---- settings (per browser) ----
const SKEY = "kps:studio";
export function studioSettings() {
  try { const v = JSON.parse(localStorage.getItem(SKEY) || "{}"); return { layout: v.layout === "one" ? "one" : "all", preview: v.preview !== false, colors: v.colors !== false }; }
  catch (e) { return { layout: "all", preview: true, colors: true }; }
}
const saveSettings = s => { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} };
const lsList = k => { try { const a = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const lsSet = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} };

// ---- the shot ----
// env: { data, scenes, outfits, cams, places(), items() }. st: the node's studio state. wired: values from linked nodes.
export function layersOf(env, st, wired = {}) {
  const ps = st.person || {};
  const person = "person" in wired ? wired.person || ""
    : ps.on === false ? "" : (String(ps.text || "").trim() || personText(ps.picks || {}));
  let outfit = null, scene = null, camera = null;
  if ("outfit" in wired) outfit = wired.outfit || null;
  else if (env.outfits && st.outfit) outfit = outfitParts(env.outfits, st.outfit, env.items());
  if ("scene" in wired) scene = wired.scene || null;
  else if (env.scenes && st.scene) { const p = sceneParts(env.scenes, st.scene, env.places()); scene = p.bg || p.extra || p.light || p.plate ? p : null; }
  if ("camera" in wired) camera = wired.camera || null;
  else if (env.cams && st.camera) camera = camParts(env.cams, st.camera);
  return { person, outfit, scene, camera };
}

// The prompt for one frame, plus the pieces of it each layer wrote (for the colored underlines).
export function shotOf(env, frame, st, { trigger = "", style = true, wired = {} } = {}) {
  const L = layersOf(env, st, wired);
  let f = withEdit(frame, st.edits || {});
  const applied = { outfit: false, scene: false };
  if (L.outfit && env.outfits) { const [t, ch] = withOutfit(env.outfits, f, L.outfit, st.outfitOverrides || []); if (ch) { f = { ...f, text: t, bare: undefined }; applied.outfit = true; } }
  if (L.scene && env.scenes) { const [t, ch] = withScene(env.scenes, f, L.scene, st.sceneOverrides || []); if (ch) { f = { ...f, text: t, bare: undefined }; applied.scene = true; } }
  const text = promptFor(f, { trigger, person: L.person, style, camera: L.camera });
  const marks = [];
  if (L.person) marks.push(["person", L.person]);
  if (applied.outfit) marks.push(["outfit", outfitText(L.outfit)]);
  if (applied.scene) for (const x of [L.scene.bg, L.scene.extra, L.scene.light]) if (x) marks.push(["scene", x]);
  const c = L.camera;
  if (c && c.on) for (const x of [c.device, c.frame, c.light, c.lookLight, c.grade, c.finish, c.flaws, c.skin, c.medium]) if (x) marks.push(["camera", x]);
  return { text, marks, layers: L, applied };
}

// Wrap the parts of text that each layer wrote, longest first so they don't cut into each other.
export function markHTML(text, marks) {
  const low = text.toLowerCase(), taken = [];
  const hits = [];
  for (const [layer, s] of [...marks].sort((a, b) => b[1].length - a[1].length)) {
    const needle = s.replace(/\.$/, "").toLowerCase().trim();
    if (needle.length < 3) continue;
    let i = low.indexOf(needle);
    while (i >= 0 && taken.some(([a, b]) => i < b && i + needle.length > a)) i = low.indexOf(needle, i + 1);
    if (i < 0) continue;
    taken.push([i, i + needle.length]); hits.push([i, i + needle.length, layer]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  let out = "", at = 0;
  for (const [a, b, layer] of hits) { out += `<span class="kst-seg kst-l-frame">${esc(text.slice(at, a))}</span><span class="kst-seg kst-l-${layer}">${esc(text.slice(a, b))}</span>`; at = b; }
  return out + `<span class="kst-seg kst-l-frame">${esc(text.slice(at))}</span>`;
}

// Short lines for the node card's chips.
export function summaries(env, st, wired = {}) {
  const out = {};
  const ps = st.person || {};
  out.person = "person" in wired ? { text: "From Person node", wired: true }
    : ps.on === false ? { text: "Off", off: true }
    : ps.text ? { text: "Your wording" } : { text: shortPersonAll(env, ps.picks || {}) || "Anyone" };
  const o = st.outfit && env.outfits ? outfitParts(env.outfits, st.outfit, env.items()) : null;
  out.outfit = "outfit" in wired ? { text: "From Outfit node", wired: true } : !o || !o.pieces.length ? { text: "Frame's own" } : !o.on ? { text: "Off", off: true }
    : { text: cap(o.pieces.map(p => p.text.replace(/^(an? )/i, "")).slice(0, 2).join(", ")) };
  const s = st.scene && env.scenes ? sceneParts(env.scenes, st.scene, env.places()) : null;
  out.scene = "scene" in wired ? { text: "From Scene node", wired: true } : !s || !(s.bg || s.extra || s.light || s.plate) ? { text: "Frame's own" } : !s.on ? { text: "Off", off: true }
    : { text: (s.plate ? "Clean plate" + (s.label ? ", " : "") : "") + (s.label || (s.extra ? "Adjusted" : "")) };
  const c = st.camera && env.cams ? camParts(env.cams, st.camera) : null;
  out.camera = "camera" in wired ? { text: "From Camera node", wired: true } : !c || !(c.cam || c.look || c.skin) ? { text: "Frame's own" } : !c.on ? { text: "Off", off: true } : { text: camLabel(c) };
  return out;
}
function traitsAll(env) { return traitOrder(env.data.traits).map(t => ({ ...t, options: t.options.concat((env.choices() || []).filter(c => c.layer === "person" && c.group === t.key).map(c => ({ value: c.text, name: c.name, mine: c.id, hex: c.hex }))) })); }
function shortPersonAll(env, picks) {
  const T = traitsAll(env);
  const s = shortPerson(T, picks);
  if (s) return s;
  const any = T.map(t => picks[t.key] && (t.options.find(o => o.value === picks[t.key]) || {}).name).filter(Boolean);
  return any.slice(0, 2).join(", ");
}

let current = null;

// ctx: { state(), save(state), frame(), setFrame(f), mode(), setMode(v), trigger(), setTrigger(v), style(), setStyle(v),
//        wired(), thumbs(), openPicker(), editPrompt(f, done), setPreview(fid), saveItem(p), deleteItem(id), savePlace(p),
//        deletePlace(id), saveChoice(c), deleteChoice(id), saveCustom(p), deleteCustom(id), importCustom(items, portable), refresh() }
export function openStudio({ env, ctx, tab = "frame" }) {
  if (current) current.close();
  const st = { layer: LAYERS.some(l => l.key === tab) ? tab : "frame", s: JSON.parse(JSON.stringify(ctx.state() || {})), cur: {}, exp: new Set(), add: null, armed: null, settings: studioSettings(), q: "" };
  for (const k of ["person", "outfit", "scene", "camera"]) if (!st.s[k] || typeof st.s[k] !== "object") st.s[k] = {};
  if (!st.s.person.picks) st.s.person.picks = {};

  const el = document.createElement("div");
  el.className = "kq kst";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Call Sheet Studio");
  el.innerHTML = `<div class="kq-box">
    <header class="kq-head kst-head">
      <button type="button" class="kq-icon" data-x="close" aria-label="Close the Studio">${ICON.back}</button>
      <nav class="kst-tabs" role="tablist" aria-label="Layers"></nav>
      <span class="kq-grow"></span>
      <div class="kst-saved-wrap"></div>
      <button type="button" class="kq-ghost" data-x="reset">Reset</button>
      <div class="kst-gear-wrap"><button type="button" class="kq-icon" data-x="gear" aria-label="Studio settings" aria-expanded="false">${ICON.gear}</button>
        <div class="kst-menu" role="dialog" aria-label="Studio settings" hidden></div></div>
      <button type="button" class="kq-primary kq-sm" data-x="done">Done</button>
    </header>
    <div class="kst-body">
      <nav class="kst-list" aria-label="Groups"></nav>
      <section class="kst-mid"></section>
      <aside class="kst-side"></aside>
    </div>
    <footer class="kst-prompt"><div class="kst-ptext"></div><div class="kst-pbar"><span class="kq-dim kst-pnote"></span><span class="kq-grow"></span><button type="button" class="kq-ghost kq-tight" data-x="copy">${ICON.copy}<span>Copy</span></button></div></footer>
  </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const mid = q(".kst-mid");

  const save = () => ctx.save(JSON.parse(JSON.stringify(st.s)));
  const wired = () => ctx.wired() || {};
  const isWired = L => L in wired();

  // ---------- groups per layer ----------
  // A group: { k, label, card?, multi?, noAny?, opts: [{ v, n, sw?, d?, bg?, img?, mine?, title? }], get(), set(v), extra?(), add?: {...}, note? }
  function frameGroups() {
    const data = env.data, favs = new Set(lsList("kps:favs")), recent = lsList("kps:recent");
    const frames = data.frames;
    const opt = f => ({ v: f.id, n: f.title, f, mine: f.tab === "custom" ? f.id : null });
    const g = (k, label, list, extra = {}) => ({ k, label, card: "frame", noAny: true, opts: list.map(opt), get: () => ctx.frame()?.id, set: v => { const f = frames.find(x => x.id === v); if (f) { ctx.setFrame(f); markUsed(f.id); } }, ...extra });
    const out = [];
    const starred = frames.filter(f => favs.has(f.id));
    if (starred.length) out.push(g("starred", "Starred", starred));
    const rec = recent.map(id => frames.find(f => f.id === id)).filter(Boolean).slice(0, 16);
    if (rec.length) out.push(g("recent", "Recent", rec));
    for (const t of data.tabs) {
      const list = frames.filter(f => f.tab === t.id);
      if (t.id === "custom") continue;
      if (list.length) out.push(g("tab:" + t.id, t.name, list));
    }
    out.push(g("tab:custom", "Custom", frames.filter(f => f.tab === "custom"), { add: { kind: "prompt", label: "New prompt" } }));
    return out;
  }
  function markUsed(id) { const r = [id, ...lsList("kps:recent").filter(x => x !== id)].slice(0, 40); lsSet("kps:recent", r); }

  function personGroups() {
    const P = st.s.person;
    return traitsAll(env).map(t => ({
      k: t.key, label: t.label,
      opts: t.options.map(o => ({ v: o.value, n: o.name, sw: (SWATCH[t.key] && SWATCH[t.key][o.value]) || o.hex || null, mine: o.mine || null })),
      get: () => P.picks[t.key] || "", set: v => { if (v) P.picks[t.key] = v; else delete P.picks[t.key]; P.text = ""; P.on = true; },
      add: { kind: "choice", layer: "person", group: t.key, ph: t.options[1] ? t.options[1].value : "" },
    }));
  }

  function outfitGroups() {
    const O = st.s.outfit, out = env.outfits;
    if (!out) return [];
    const items = env.items() || [];
    const colorHex = c => (out.colors.find(x => x.value === c) || {}).hex;
    return out.categories.map(c => {
      const multi = c.key === "acc";
      const opts = c.options.map(o => ({ v: o.value, n: o.name, sw: o.color ? colorHex(O[c.key + "C"] && O[c.key] === o.value ? O[c.key + "C"] : o.color) : null }))
        .concat(items.filter(i => i.cat === c.key).map(i => ({ v: i.id, n: i.name, sw: i.hex || null, mine: i.id, title: i.text })));
      return {
        k: c.key, label: c.label, multi, opts,
        get: () => multi ? (Array.isArray(O.acc) ? O.acc : []) : O[c.key] || "",
        set: v => {
          O.on = true;
          if (multi) { const a = Array.isArray(O.acc) ? O.acc : []; O.acc = v === null ? [] : a.includes(v) ? a.filter(x => x !== v) : [...a, v]; return; }
          if (!v) { delete O[c.key]; delete O[c.key + "C"]; return; }
          if (O[c.key] !== v) delete O[c.key + "C"];
          O[c.key] = v;
          if (c.key === "one") { delete O.top; delete O.topC; delete O.bottom; delete O.bottomC; }
          if (c.key === "top" || c.key === "bottom") { delete O.one; delete O.oneC; }
        },
        extra: multi ? null : () => colorRow(c),
        add: { kind: "item", cat: c.key, ph: (c.options[1] || c.options[0] || {}).text?.replace("{c}", (out.colors[0] || {}).word || "") },
      };
    });
  }
  function colorRow(c) {
    const O = st.s.outfit, v = O[c.key], o = v && c.options.find(x => x.value === v);
    if (!o || !o.color) return "";
    const cur = O[c.key + "C"] || o.color;
    return `<div class="kst-colors" role="group" aria-label="${esc(o.name)} color"><span class="kq-dim">${esc(o.name)} color</span>${env.outfits.colors.map(col =>
      `<button type="button" class="kst-swatch" data-color="${esc(c.key)}:${esc(col.value)}" aria-pressed="${col.value === cur}" title="${esc(col.word)}" aria-label="${esc(col.word)}" style="--sw:${esc(col.hex)}"></button>`).join("")}</div>`;
  }

  function sceneGroups() {
    const S = st.s.scene, sc = env.scenes;
    if (!sc) return [];
    const pl = env.places();
    const g = [{
      k: "place", label: "Places", opts: pl.map(p => ({ v: p.id, n: p.title, mine: p.mine ? p.id : null, title: p.bg })),
      get: () => S.place || "", set: v => { S.on = true; if (v) { S.place = v; delete S.location; } else delete S.place; },
      add: { kind: "place" },
    }];
    for (const c of sc.categories) g.push({
      k: c.key, label: c.label, opts: c.options.map(o => ({ v: o.value, n: o.name, sw: o.swatch || null, mine: o.mine ? o.value : null, title: o.text })),
      get: () => S[c.key] || "", set: v => { S.on = true; if (v) { S[c.key] = v; if (c.key === "location") delete S.place; } else delete S[c.key]; },
      add: { kind: "choice", layer: "scene", group: c.key, ph: (c.options[1] || c.options[0]).text },
    });
    return g;
  }

  function cameraGroups() {
    const C = st.s.camera, cams = env.cams;
    if (!cams) return [];
    const cam = C.cam ? cams.cameras.find(c => c.value === C.cam) : null;
    const look = C.look && cams.looks ? cams.looks.find(l => l.value === C.look) : null;
    const art = !!(look && look.art);
    const g = [{
      k: "cam", label: "Camera", card: "desc", opts: cams.cameras.map(c => ({ v: c.value, n: c.name, d: c.short, icon: c.value, mine: c.mine ? c.value : null })),
      get: () => C.cam || "", set: v => { C.on = true; if (v) { if (C.cam !== v) C.flaws = {}; C.cam = v; } else { delete C.cam; C.flaws = {}; } },
      add: { kind: "choice", layer: "camera", group: "cam", ph: cams.cameras[0].device }, note: art ? "An art style sets its own medium, so the camera is skipped." : "",
    }];
    const flawOn = f => C.flaws && typeof C.flaws[f.key] === "boolean" ? C.flaws[f.key] : f.on;
    g.push({
      k: "flaws", label: "Flaws", multi: true, noAny: true, empty: cam ? "" : "Pick a camera to see its flaws.",
      opts: cam ? cam.flaws.map(f => ({ v: f.key, n: f.name, title: f.text, mine: f.mine ? f.key : null })) : [],
      get: () => cam ? cam.flaws.filter(flawOn).map(f => f.key) : [],
      set: v => { if (!cam || !v) return; const f = cam.flaws.find(x => x.key === v); C.flaws = { ...(C.flaws || {}), [v]: !flawOn(f) }; },
      add: cam ? { kind: "choice", layer: "camera", group: "flaws", ph: (cam.flaws[0] || {}).text } : null,
      val: () => cam ? `${cam.flaws.filter(flawOn).length} on` : "None",
    });
    const groups = [...new Set((cams.looks || []).map(l => l.group))];
    for (const G of groups) {
      const ls = cams.looks.filter(l => l.group === G);
      g.push({
        k: "look:" + G, label: G, card: "look", noAny: true, opts: ls.map(l => ({ v: l.value, n: l.name, d: l.short, bg: l.swatch, mine: l.mine ? l.value : null })),
        get: () => C.look || "", set: v => { C.on = true; if (v) C.look = v; else if (ls.some(l => l.value === C.look)) delete C.look; },
        val: () => ls.find(l => l.value === C.look)?.name || "Any",
        add: { kind: "choice", layer: "camera", group: "look:" + G, ph: ls[0] && (ls[0].art ? ls[0].grade : ls[0].grade) },
      });
    }
    const bitOn = b => C.skinBits && typeof C.skinBits[b.key] === "boolean" ? C.skinBits[b.key] : b.on;
    g.push({
      k: "skin", label: "Real skin", multi: true, noAny: true, opts: cams.skin.map(b => ({ v: b.key, n: b.name, title: b.text, mine: b.mine ? b.key : null })),
      get: () => C.skin ? cams.skin.filter(bitOn).map(b => b.key) : [],
      set: v => { C.on = true; if (!v) return; const b = cams.skin.find(x => x.key === v); if (!C.skin) { C.skin = true; C.skinBits = { ...(C.skinBits || {}), [v]: true }; return; } C.skinBits = { ...(C.skinBits || {}), [v]: !bitOn(b) }; },
      head: () => `<button type="button" class="kq-switch" data-skin aria-pressed="${!!C.skin}" aria-label="Real skin"><span></span></button>`,
      val: () => C.skin ? `On, ${cams.skin.filter(bitOn).length} details` : "Off",
      add: { kind: "choice", layer: "camera", group: "skin", ph: (cams.skin[2] || cams.skin[0]).text }, note: art ? "Art styles skip real skin." : "",
    });
    return g;
  }
  const groupsFor = L => L === "frame" ? frameGroups() : L === "person" ? personGroups() : L === "outfit" ? outfitGroups() : L === "scene" ? sceneGroups() : cameraGroups();

  // ---------- rendering ----------
  const isOn = (g, v) => { const x = g.get(); return Array.isArray(x) ? x.includes(v) : x === v; };
  function valueOf(g) {
    if (g.val) return g.val();
    const x = g.get(), nm = v => (g.opts.find(o => o.v === v) || {}).n || "";
    if (g.card === "frame") { const f = ctx.frame(); return f && g.opts.some(o => o.v === f.id) ? f.title : `${g.opts.length}`; }
    if (Array.isArray(x)) return x.length ? (x.length > 1 ? `${x.length} picked` : nm(x[0])) : "None";
    return x ? nm(x) || "Yours" : "Any";
  }
  const isSet = (g, v) => g.card === "frame" ? !!ctx.frame() && g.opts.some(o => o.v === ctx.frame().id) : !/^(Any|None|Off|\d+|0 on)$/.test(v);
  const LIMIT = { frame: 8, look: 6, desc: 6, chip: 12 };

  function tabsHTML() {
    const w = wired(), sum = summaries(env, st.s, w);
    q(".kst-tabs").innerHTML = LAYERS.map(l => {
      const s = sum[l.key] || {};
      const cls = l.key === "frame" ? "" : s.wired ? "is-wired" : s.off ? "is-off" : /^(Frame's own|Anyone)$/.test(s.text || "") ? "is-empty" : "is-set";
      return `<button type="button" role="tab" class="kst-tab kst-l-${l.key} ${cls}" data-layer="${l.key}" aria-selected="${l.key === st.layer}" title="${esc(s.text || "")}"><i></i>${esc(l.label)}${s.wired ? ICON.link : ""}</button>`;
    }).join("");
  }
  function listHTML(G) {
    q(".kst-list").innerHTML = G.map(g => { const v = valueOf(g);
      return `<button type="button" data-jump="${esc(g.k)}" class="${isSet(g, v) ? "is-set" : ""}" aria-current="${g.k === st.cur[st.layer]}"><span>${esc(g.label)}</span><span>${esc(g.card === "frame" && !isSet(g, v) ? v + " frames" : v)}</span></button>`; }).join("");
  }
  function optHTML(g, o, big) {
    const on = isOn(g, o.v), attrs = `data-g="${esc(g.k)}" data-v="${esc(o.v)}" aria-pressed="${on}"${o.title ? ` title="${esc(o.title)}"` : ""}`;
    let b;
    if (g.card === "frame") b = `<button type="button" class="kst-fc" ${attrs}>${thumbHTML(o.f, ctx.thumbs())}<span><b>${esc(o.n)}</b><small>${frameNo(o.f.id)} · ${esc(env.data.sets[o.f.set] || "")}</small></span></button>`;
    else if (g.card === "look") b = `<button type="button" class="kst-lk" ${attrs}><span class="kst-lsw" style="background:${esc(o.bg || "")}"></span><span><b>${esc(o.n)}</b><small>${esc(o.d || "")}</small></span></button>`;
    else if (g.card === "desc") b = `<button type="button" class="kst-desc" ${attrs}><span class="kst-dicon">${cameraIcon(o.icon, 22)}</span><span><b>${esc(o.n)}</b><small>${esc(o.d || "")}</small></span></button>`;
    else b = `<button type="button" class="kst-c${big ? " is-big" : ""}" ${attrs}>${o.sw ? `<i style="--sw:${esc(o.sw)}"></i>` : ""}<span>${esc(o.n)}</span>${big && on ? ICON.check : ""}</button>`;
    if (!o.mine) return b;
    const armed = st.armed === g.k + "|" + o.v;
    return `<span class="kst-mine">${b}<button type="button" class="kst-del${armed ? " is-armed" : ""}" data-del="${esc(g.k)}" data-dv="${esc(o.v)}" aria-label="Delete ${esc(o.n)}" title="${armed ? "Click again to delete" : "Delete"}">${armed ? "Delete?" : "×"}</button></span>`;
  }
  function anyHTML(g, big) {
    if (g.noAny) return "";
    const x = g.get(), on = Array.isArray(x) ? !x.length : !x;
    const cls = g.card === "look" ? "kst-lk is-any" : g.card === "desc" ? "kst-desc is-any" : `kst-c is-any${big ? " is-big" : ""}`;
    return `<button type="button" class="${cls}" data-g="${esc(g.k)}" data-v="" aria-pressed="${on}"><span>${g.multi ? "None" : st.layer === "frame" ? "" : "Any"}</span></button>`;
  }
  function addHTML(g) {
    if (!g.add) return "";
    const open = st.add && st.add.k === g.k, kind = open && st.add.kind;
    const label = g.add.kind === "prompt" ? "New prompt" : g.add.kind === "place" ? "New place" : "Add";
    const cls = g.card === "frame" ? "kst-fc kst-addc" : g.card === "look" ? "kst-lk kst-addc" : g.card === "desc" ? "kst-desc kst-addc" : "kst-c kst-add";
    const btn = `<button type="button" class="${cls}" data-add="${esc(g.k)}" aria-expanded="${!!open && !kind}"><span>+ ${label}</span></button>`;
    return g.add.kind !== "prompt" ? btn
      : `<div class="kst-addpair">${btn}<button type="button" class="${cls}" data-add="${esc(g.k)}" data-addkind="import" aria-expanded="${kind === "import"}"><span>Import a list</span></button></div>`;
  }
  function formHTML(g) {
    if (!st.add || st.add.k !== g.k) return "";
    const a = g.add, err = st.add.err ? `<span class="kst-ferr">${esc(st.add.err)}</span>` : "";
    if (a.kind === "prompt" && st.add.kind === "import") return `<form class="kst-form kst-form-wide" data-form="${esc(g.k)}" data-import>
      <textarea name="t" rows="8" placeholder="Paste prompts, one per line" required>${esc(st.add.text || "")}</textarea>
      <label class="kst-fchk"><input type="checkbox" name="p"> Works with scenes (their settings can be swapped)</label>
      <div class="kst-fbtn">${err}<button type="button" class="kq-link" data-pickfile>Choose a .txt file</button><input type="file" accept=".txt,text/plain" data-listfile hidden><span class="kq-grow"></span><span class="kq-dim" data-importn></span><button type="button" class="kq-ghost" data-cancel>Cancel</button><button type="submit" class="kq-primary kq-sm" disabled>Add</button></div></form>`;
    if (a.kind === "prompt") return `<form class="kst-form kst-form-wide" data-form="${esc(g.k)}">
      <input name="n" maxlength="80" placeholder="Name it, like Window seat with tea" required>
      <textarea name="t" rows="3" placeholder="[trigger] curled up on a deep window seat, holding a mug with both hands. Wearing an oversized knit sweater. A rainy window behind her. Medium shot at eye level. Soft gray daylight." required></textarea>
      <label class="kst-fchk"><input type="checkbox" name="p"> Works with scenes (its setting can be swapped)</label>
      <div class="kst-fbtn">${err}<span class="kq-grow"></span><button type="button" class="kq-ghost" data-cancel>Cancel</button><button type="submit" class="kq-primary kq-sm">Save</button></div></form>`;
    if (a.kind === "place") return `<form class="kst-form" data-form="${esc(g.k)}">
      <input name="n" maxlength="60" placeholder="Name it, like Grandma's kitchen" required>
      <input name="t" placeholder="The setting, like a small 1970s kitchen with mustard tiles and a lace curtain" required>
      <input name="l" placeholder="Light (optional), like Warm light from a ceiling lamp.">
      <div class="kst-fbtn">${err}<span class="kq-grow"></span><button type="button" class="kq-ghost" data-cancel>Cancel</button><button type="submit" class="kq-primary kq-sm">Save</button></div></form>`;
    const ph = a.ph ? `How it reads, like “${a.ph}”` : "How it reads in the prompt";
    const color = a.kind === "item" || (a.layer === "person" && /^(hcolor|eyes|skin)$/.test(a.group));
    return `<form class="kst-form" data-form="${esc(g.k)}">
      <input name="n" maxlength="60" placeholder="Name it" required>
      <input name="t" placeholder="${esc(ph)}" required>
      ${color ? `<label class="kst-fcol" title="Color for the swatch and the figure"><input type="color" name="c" value="#8b6a4a"><span>Color</span></label>` : ""}
      <div class="kst-fbtn">${err}<span class="kq-grow"></span><button type="button" class="kq-ghost" data-cancel>Cancel</button><button type="submit" class="kq-primary kq-sm">Save</button></div></form>`;
  }
  function groupHTML(g, one) {
    const id = st.layer + ":" + g.k, lim = LIMIT[g.card || "chip"], many = g.opts.length > lim, exp = one || st.exp.has(id);
    let vis = g.opts;
    if (many && !exp) { vis = g.opts.slice(0, lim); for (const o of g.opts.slice(lim)) if (isOn(g, o.v)) vis = vis.concat(o); }
    const hidden = g.opts.length - vis.length;
    const wrap = g.card === "frame" ? "kst-frames" : g.card === "look" ? "kst-looks" : g.card === "desc" ? "kst-descs" : one ? "kst-grid" : "kst-chips";
    const filter = exp && g.opts.length > 16 ? `<input type="search" class="kst-filter" data-filter="${esc(g.k)}" placeholder="Filter ${g.opts.length} ${esc(g.label.toLowerCase())}" aria-label="Filter ${esc(g.label)}">` : "";
    const more = hidden ? `<button type="button" class="kst-c kst-more" data-more="${esc(g.k)}"><span>+${hidden} more</span></button>`
      : many && !one ? `<button type="button" class="kst-c kst-more" data-more="${esc(g.k)}"><span>Show less</span></button>` : "";
    const body = g.empty && !g.opts.length ? `<p class="kq-dim kst-empty">${esc(g.empty)}</p>`
      : `<div class="${wrap}" data-wrap="${esc(g.k)}">${anyHTML(g, one)}${vis.map(o => optHTML(g, o, one)).join("")}${more}${addHTML(g)}</div><p class="kq-dim kst-nomatch" data-nomatch="${esc(g.k)}" hidden>No match. Use + ${g.add && g.add.kind === "prompt" ? "New prompt" : "Add"} to make it.</p>`;
    return `<div class="kst-group" data-group="${esc(g.k)}"><div class="kst-gh"><h3${one ? ' class="is-big"' : ""}>${esc(g.label)}</h3>${g.head ? g.head() : ""}</div>
      ${g.note ? `<p class="kst-note">${esc(g.note)}</p>` : ""}${filter}${body}${formHTML(g)}${st.notice && st.notice.k === g.k ? `<p class="kst-note" role="status">${esc(st.notice.text)}</p>` : ""}${g.extra ? g.extra() : ""}</div>`;
  }
  function topHTML() {
    const L = st.layer;
    let h = "";
    if (L !== "frame" && isWired(L)) h += `<div class="kst-banner">${ICON.link}<span>Using the linked ${NODE_NAME[L]}. Unlink it to use this tab.</span></div>`;
    const f = ctx.frame();
    if (L === "outfit" && f && env.outfits && outfitLocked(env.outfits, f, st.s.outfitOverrides || [])) {
      const over = (st.s.outfitOverrides || []).includes(f.id);
      h += `<div class="kst-banner is-lock">${ICON.lock}<span>This frame keeps its own clothes: the pose uses ${esc(garmentOf(env.outfits, f))}.</span><button type="button" class="kq-ghost kq-tight" data-override="outfit">${over ? "Keep its own" : "Use outfit anyway"}</button></div>`;
    } else if (L === "outfit" && f && (st.s.outfitOverrides || []).includes(f.id)) {
      h += `<div class="kst-banner">${ICON.lock}<span>Using the outfit on a frame that relies on its own clothes.</span><button type="button" class="kq-ghost kq-tight" data-override="outfit">Keep its own</button></div>`;
    }
    if (L === "scene" && f && env.scenes) {
      const over = (st.s.sceneOverrides || []).includes(f.id);
      if (over || sceneLocked(env.scenes, f, [])) h += `<div class="kst-banner is-lock">${ICON.lock}<span>${over ? "Using the scene on a frame that needs its own location." : `This frame keeps its own location: the pose uses ${esc(propOf(env.scenes, f))}.`}</span><button type="button" class="kq-ghost kq-tight" data-override="scene">${over ? "Keep its own" : "Use scene anyway"}</button></div>`;
    }
    if (L === "outfit") { const sw = st.s.outfit.swap === "pick" ? "pick" : "whole";
      h += `<div class="kst-segs" role="group" aria-label="What the outfit replaces"><button type="button" data-swap="whole" aria-pressed="${sw === "whole"}">Whole outfit</button><button type="button" data-swap="pick" aria-pressed="${sw === "pick"}">Just what I pick</button></div>`; }
    if (L === "frame") h += `<input type="search" class="kst-search" data-search placeholder="Search all ${env.data.frames.length} frames" aria-label="Search frames" value="${esc(st.q)}">`;
    return h;
  }
  function midHTML(G) {
    const top = topHTML();
    if (st.layer === "frame" && st.q.trim()) {
      const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = env.data.frames.filter(f => { const hay = (f.title + " " + f.text + " " + (env.data.sets[f.set] || "")).toLowerCase(); return words.every(w => hay.includes(w)); });
      const g = { ...G.find(x => x.k.startsWith("tab:")), k: "search", label: `${hits.length} ${hits.length === 1 ? "frame" : "frames"}`, add: null, opts: hits.map(f => ({ v: f.id, n: f.title, f, mine: null })) };
      st.exp.add("frame:search");
      return top + (hits.length ? groupHTML(g, false) : `<p class="kq-dim kst-empty">No frames match. Try fewer words, or add your own in Custom.</p>`);
    }
    if (st.settings.layout === "all") return top + G.map(g => groupHTML(g, false)).join("");
    let i = G.findIndex(g => g.k === st.cur[st.layer]);
    if (i < 0) { i = 0; st.cur[st.layer] = G[0] && G[0].k; }
    if (!G[i]) return top;
    return top + groupHTML(G[i], true) + `<div class="kst-steps"><button type="button" class="kq-ghost" data-step="-1" ${i ? "" : "disabled"}>‹ ${esc(i ? G[i - 1].label : "")}</button>
      <span class="kq-dim">${i + 1} of ${G.length}</span><button type="button" class="kq-ghost" data-step="1" ${i < G.length - 1 ? "" : "disabled"}>${esc(i < G.length - 1 ? G[i + 1].label : "")} ›</button></div>`;
  }

  // ---------- right side ----------
  function chipsHTML(G) {
    const out = [];
    for (const g of G) { const x = g.get(); for (const v of Array.isArray(x) ? x : x ? [x] : []) { const o = g.opts.find(o => o.v === v); if (o) out.push(`<button type="button" class="kq-chip" data-unpick="${esc(g.k)}" data-uv="${esc(v)}" title="Remove">${esc(o.n)} <span>×</span></button>`); } }
    return out.length ? `<div class="kst-picks">${out.join("")}</div>` : `<p class="kq-dim kst-picks-none">Nothing picked. The frame keeps its own.</p>`;
  }
  function useSwitch(L, label) {
    const on = st.s[L].on !== false;
    return `<div class="kst-row"><span>${esc(label)}</span><span class="kq-grow"></span><button type="button" class="kq-switch" data-use="${L}" aria-pressed="${on}" aria-label="${esc(label)}"><span></span></button></div>`;
  }
  function sideHTML(G) {
    const L = st.layer, f = ctx.frame();
    if (L === "frame") {
      if (!f) return `<p class="kq-dim">Pick a frame to start.</p>`;
      const tabName = (env.data.tabs.find(t => t.id === f.tab) || {}).name || "";
      const sl = env.scenes ? sceneLocked(env.scenes, f, []) : false, ol = env.outfits ? outfitLocked(env.outfits, f, []) : false;
      const edited = !!(st.s.edits && st.s.edits[f.id]);
      return `<div class="kst-fbig">${thumbHTML(f, ctx.thumbs())}</div>
        <div><div class="kst-ftitle"><span class="kps-no">${frameNo(f.id)}</span> ${esc(f.title)}${edited ? ' <span class="kst-badge">Edited</span>' : ""}</div><div class="kq-dim">${esc(tabName)} · ${esc(env.data.sets[f.set] || "")}</div></div>
        <div class="kst-tags"><span class="${sl ? "is-lock" : ""}">${sl ? ICON.lock + " Keeps its location" : "Works with scenes"}</span><span class="${ol ? "is-lock" : ""}">${ol ? ICON.lock + " Keeps its clothes" : "Works with outfits"}</span></div>
        <label class="kst-row"><span>Mode</span><span class="kq-grow"></span><select data-mode>${["single frame", "whole set", "whole tab"].map(m => `<option ${m === ctx.mode() ? "selected" : ""}>${m}</option>`).join("")}</select></label>
        <label class="kst-row"><span>Trigger</span><span class="kq-grow"></span><input data-trigger value="${esc(ctx.trigger())}" placeholder="LoRA trigger" spellcheck="false"></label>
        <div class="kst-row"><span>Style words</span><span class="kq-grow"></span><button type="button" class="kq-switch" data-style aria-pressed="${ctx.style()}" aria-label="Style words"><span></span></button></div>
        <div class="kst-btns"><button type="button" class="kq-ghost kq-filled" data-x="edit">${edited ? "Edit your wording" : "Edit prompt"}</button>${edited ? `<button type="button" class="kq-ghost" data-x="unedit">Reset wording</button>` : ""}
          <button type="button" class="kq-ghost" data-x="star">${lsList("kps:favs").includes(f.id) ? "Unstar" : "Star"}</button>
          ${ctx.setPreview ? `<button type="button" class="kq-ghost" data-x="preview">Use last render as preview</button>` : ""}
          ${ctx.openPicker ? `<button type="button" class="kq-ghost" data-x="picker">Open full picker</button>` : ""}</div>`;
    }
    if (L === "person") {
      const P = st.s.person, wording = P.text || personText(P.picks);
      // Your own colors show on the figure too.
      for (const c of env.choices() || []) if (c.layer === "person" && c.hex && SWATCH[c.group] && !SWATCH[c.group][c.text]) SWATCH[c.group][c.text] = c.hex;
      return `${st.settings.preview ? `<div class="kst-stage">${figureSVG(P.picks, { width: 200, height: 330, label: "Figure preview" })}</div>` : ""}${chipsHTML(G)}
        <label class="kst-wlabel" for="kst-wording">Wording <span class="kq-dim">${P.text ? "yours" : "built from your picks"}</span>${P.text ? `<button type="button" class="kq-link" data-x="rewording">Reset</button>` : ""}</label>
        <textarea id="kst-wording" class="kst-wording" rows="3" placeholder="Pick traits, or write who is in the shot">${esc(wording)}</textarea>
        ${useSwitch("person", "Use this person")}`;
    }
    if (L === "outfit") {
      const O = st.s.outfit;
      return `${st.settings.preview && env.outfits ? `<div class="kst-stage">${outfitSVG(env.outfits, O, env.items(), { on: O.on !== false, aria: "Outfit preview" })}</div>` : ""}${chipsHTML(G)}${useSwitch("outfit", "Use this outfit")}`;
    }
    if (L === "scene") {
      const S = st.s.scene, pl = S.place ? env.places().find(p => p.id === S.place) : null;
      const loc = S.location && env.scenes ? env.scenes.categories[0].options.find(o => o.value === S.location) : null;
      const look = { kind: pl ? kindOf(pl.title + " " + pl.bg) : loc ? loc.kind || "none" : "none", time: pl ? timeOf(pl.light + " " + pl.bg) : "" };
      return `${st.settings.preview ? `<div class="kst-stage kst-stage-wide">${sceneSVG(S, { ...look, on: S.on !== false, plate: !!S.plate, aria: "Scene preview" })}</div>` : ""}${chipsHTML(G)}
        <div class="kst-row"><span>Clean plate <span class="kq-dim">(nobody in the shot)</span></span><span class="kq-grow"></span><button type="button" class="kq-switch" data-plate aria-pressed="${!!S.plate}" aria-label="Clean plate"><span></span></button></div>
        ${useSwitch("scene", "Use this scene")}`;
    }
    const C = st.s.camera, p = env.cams ? camParts(env.cams, C) : null, lk = C.look && env.cams ? env.cams.looks.find(l => l.value === C.look) : null;
    return `${st.settings.preview ? `<div class="kst-stage kst-cam"${lk ? ` style="--look:${esc(lk.swatch)}"` : ""}><span class="kst-camicon">${cameraIcon(p && p.cam, 64)}</span><span class="kst-camname">${esc(p ? camLabel(p) || "Frame's own camera" : "")}</span></div>` : ""}${chipsHTML(G)}${useSwitch("camera", "Use this camera")}`;
  }

  // ---------- prompt ----------
  function promptHTML() {
    const f = ctx.frame();
    if (!f) { q(".kst-ptext").textContent = "Pick a frame to see the prompt."; q(".kst-pnote").textContent = ""; return; }
    const r = shotOf(env, f, st.s, { trigger: ctx.trigger(), style: ctx.style(), wired: wired() });
    q(".kst-ptext").innerHTML = st.settings.colors ? markHTML(r.text, r.marks) : esc(r.text);
    q(".kst-ptext").classList.toggle("no-colors", !st.settings.colors);
    const mode = ctx.mode(), n = mode === "whole set" ? env.data.frames.filter(x => x.set === f.set).length : mode === "whole tab" ? env.data.frames.filter(x => x.tab === f.tab).length : 1;
    const notes = [];
    if (n > 1) notes.push(`This frame, and ${n - 1} more in the ${mode === "whole set" ? "set" : "tab"}.`);
    if (r.layers.outfit && r.layers.outfit.on && r.layers.outfit.pieces.length && !r.applied.outfit) notes.push("This frame keeps its own clothes.");
    if (r.layers.scene && r.layers.scene.on && !r.applied.scene) notes.push("This frame keeps its own location.");
    q(".kst-pnote").textContent = notes.join(" ");
    q(".kst-prompt").dataset.text = r.text;
  }

  function settingsHTML() {
    const s = st.settings;
    q(".kst-menu").innerHTML = `<div class="kst-mh">Show choices</div>
      <label class="kst-radio"><input type="radio" name="kst-layout" value="all" ${s.layout === "all" ? "checked" : ""}><span><b>All on one page</b><small>Every group and its choices in one scroll</small></span></label>
      <label class="kst-radio"><input type="radio" name="kst-layout" value="one" ${s.layout === "one" ? "checked" : ""}><span><b>One at a time</b><small>One group as big cards, step through with ‹ ›</small></span></label>
      <div class="kst-sep"></div>
      <div class="kst-row"><span>Preview</span><span class="kq-grow"></span><button type="button" class="kq-switch" data-set="preview" aria-pressed="${s.preview}" aria-label="Preview"><span></span></button></div>
      <div class="kst-row"><span>Color the prompt by layer</span><span class="kq-grow"></span><button type="button" class="kq-switch" data-set="colors" aria-pressed="${s.colors}" aria-label="Color the prompt by layer"><span></span></button></div>
      <p class="kst-foot">Saved in this browser, for every tab.</p>`;
  }

  // ---------- saved presets (shared with the old builders) ----------
  const PRESETS = { person: "kps:presets", outfit: "kps:outfits", scene: "kps:scenes" };
  function savedHTML() {
    const k = PRESETS[st.layer];
    if (!k) { q(".kst-saved-wrap").innerHTML = ""; return; }
    const list = lsList(k), noun = { person: "people", outfit: "outfits", scene: "scenes" }[st.layer];
    q(".kst-saved-wrap").innerHTML = `<button type="button" class="kq-ghost" data-x="saved" aria-expanded="${!!st.savedOpen}">Saved ${noun} ▾</button>
      <div class="kst-menu kst-saved" ${st.savedOpen ? "" : "hidden"}>
        ${list.length ? list.map((p, i) => `<div class="kst-srow"><button type="button" class="kst-sload" data-load="${i}">${esc(p.name || "Untitled")}</button><button type="button" class="kst-del is-inline${st.armed === "saved|" + i ? " is-armed" : ""}" data-sdel="${i}" aria-label="Delete ${esc(p.name || "")}">${st.armed === "saved|" + i ? "Delete?" : "×"}</button></div>`).join("") : `<p class="kq-dim kst-foot">Nothing saved yet.</p>`}
        <div class="kst-sep"></div>
        <form class="kst-sform" data-sform><input name="n" maxlength="40" placeholder="Name this ${st.layer}"><button type="submit" class="kq-ghost kq-filled">Save current</button></form>
      </div>`;
  }

  function renderAll() {
    const G = groupsFor(st.layer);
    if (!st.cur[st.layer] && G[0]) {
      st.cur[st.layer] = st.layer === "frame" ? (G.find(g => g.opts.some(o => o.v === ctx.frame()?.id)) || G[0]).k : G[0].k;
    }
    el.classList.toggle("kst-noside", !st.settings.preview && st.layer !== "frame" && false);
    el.classList.toggle("is-wired", st.layer !== "frame" && isWired(st.layer));
    el.classList.toggle("is-layer-off", st.layer !== "frame" && st.s[st.layer] && st.s[st.layer].on === false);
    tabsHTML(); listHTML(G);
    const keep = mid.scrollTop;
    mid.innerHTML = midHTML(G);
    mid.scrollTop = keep;
    q(".kst-side").innerHTML = sideHTML(G);
    savedHTML(); promptHTML();
  }
  function changed() { save(); renderAll(); }

  // ---------- events ----------
  function countImport(form) {
    const n = parsePromptList(form.querySelector("textarea").value).length;
    form.querySelector("[data-importn]").textContent = n ? `${n} ${n === 1 ? "prompt" : "prompts"}` : "";
    const b = form.querySelector('[type="submit"]'); b.disabled = !n; b.textContent = n ? `Add ${n}` : "Add";
  }
  async function submitImport(form, g) {
    const raw = form.querySelector("textarea").value, items = parsePromptList(raw);
    if (!items.length) return;
    form.querySelector('[type="submit"]').disabled = true;
    try {
      const { added, skipped } = await ctx.importCustom(items, !!new FormData(form).get("p"));
      st.add = null;
      st.notice = { k: g.k, text: added ? `Added ${added} to Custom${skipped ? `. ${skipped} you already had were skipped.` : "."}` : "You already have all of these." };
      st.exp.add("frame:" + g.k);
      renderAll();
    } catch (e) {
      st.add = { k: g.k, kind: "import", text: raw, err: e.message || "Couldn't import" };
      renderAll();
    }
  }
  async function submitForm(form) {
    const g = groupsFor(st.layer).find(x => x.k === form.dataset.form);
    if (!g) return;
    if (form.matches("[data-import]")) return submitImport(form, g);
    const fd = new FormData(form), n = String(fd.get("n") || "").trim(), t = String(fd.get("t") || "").trim();
    if (!n || !t) return;
    const a = g.add;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      if (a.kind === "prompt") {
        const f = await ctx.saveCustom({ title: n, text: /\[trigger\]/.test(t) ? t : "[trigger] " + t, portable: !!fd.get("p") });
        if (f) { ctx.setFrame(f); markUsed(f.id); }
      } else if (a.kind === "place") {
        const p = await ctx.savePlace({ title: n, bg: t, light: String(fd.get("l") || "").trim() });
        if (p) { g.set(p.id); }
      } else if (a.kind === "item") {
        const hx = form.querySelector('[name="c"]')?.dataset.touched ? String(fd.get("c") || "") : "";
        const it = await ctx.saveItem({ cat: a.cat, name: n, text: t, hex: hx });
        if (it) { if (g.multi) { if (!isOn(g, it.id)) g.set(it.id); } else g.set(it.id); }
      } else {
        const hx = form.querySelector('[name="c"]')?.dataset.touched ? String(fd.get("c") || "") : "";
        const c = await ctx.saveChoice({ layer: a.layer, group: a.group, name: n, text: t, hex: hx });
        if (c) {
          if (a.layer === "person") g.set(c.text);
          else if (a.group === "flaws") { const C = st.s.camera; C.flaws = { ...(C.flaws || {}), [c.id]: true }; }
          else if (a.group === "skin") { const C = st.s.camera; C.skin = true; C.skinBits = { ...(C.skinBits || {}), [c.id]: true }; }
          else g.set(c.id);
        }
      }
      st.add = null;
      if (st.layer !== "frame" && st.s[st.layer]) st.s[st.layer].on = true;
      changed();
    } catch (e) {
      st.add = { k: g.k, err: e.message || "Couldn't save it" };
      renderAll();
    }
  }
  async function deleteMine(gk, v) {
    const g = groupsFor(st.layer).find(x => x.k === gk);
    if (!g) return;
    const o = g.opts.find(x => x.v === v);
    if (!o || !o.mine) return;
    try {
      if (isOn(g, v)) { if (g.multi) g.set(v); else g.set(""); }
      if (st.layer === "frame") await ctx.deleteCustom(o.mine);
      else if (st.layer === "outfit") await ctx.deleteItem(o.mine);
      else if (st.layer === "scene" && gk === "place") await ctx.deletePlace(o.mine);
      else {
        const id = st.layer === "person" ? (env.choices() || []).find(c => c.layer === "person" && c.group === gk && c.text === v)?.id : o.mine;
        if (id) await ctx.deleteChoice(id);
      }
    } catch (e) { /* the item stays; nothing else to undo */ }
    st.armed = null;
    changed();
  }

  el.addEventListener("click", e => {
    const t = e.target;
    const x = t.closest("[data-x]")?.dataset.x;
    // Close menus when clicking elsewhere.
    if (!t.closest(".kst-gear-wrap") && !q(".kst-menu").hidden) { q(".kst-menu").hidden = true; q('[data-x="gear"]').setAttribute("aria-expanded", "false"); }
    if (st.savedOpen && !t.closest(".kst-saved-wrap")) { st.savedOpen = false; savedHTML(); }
    if (x === "close" || x === "done") return close();
    if (x === "gear") { const m = q(".kst-menu"); m.hidden = !m.hidden; t.closest("button").setAttribute("aria-expanded", String(!m.hidden)); if (!m.hidden) settingsHTML(); return; }
    if (x === "saved") { st.savedOpen = !st.savedOpen; savedHTML(); return; }
    if (x === "copy") { const txt = q(".kst-prompt").dataset.text || ""; navigator.clipboard?.writeText(txt).then(() => { const s = q('[data-x="copy"] span'); s.textContent = "Copied"; setTimeout(() => s.textContent = "Copy", 1400); }, () => {}); return; }
    if (x === "reset") {
      if (st.layer === "frame") { if (st.s.edits) delete st.s.edits[ctx.frame()?.id]; }
      else if (st.layer === "person") st.s.person = { picks: {}, on: st.s.person.on };
      else st.s[st.layer] = { on: st.s[st.layer].on };
      if (st.layer === "outfit") st.s.outfitOverrides = []; if (st.layer === "scene") st.s.sceneOverrides = [];
      return changed();
    }
    if (x === "edit") { const f = ctx.frame(); if (f) ctx.editPrompt(f, (st.s.edits || {})[f.id], txt => { st.s.edits = { ...(st.s.edits || {}) }; if (txt) st.s.edits[f.id] = txt; else delete st.s.edits[f.id]; changed(); }); return; }
    if (x === "unedit") { const f = ctx.frame(); if (f && st.s.edits) { delete st.s.edits[f.id]; changed(); } return; }
    if (x === "star") { const f = ctx.frame(); if (!f) return; const a = lsList("kps:favs"); lsSet("kps:favs", a.includes(f.id) ? a.filter(i => i !== f.id) : [...a, f.id]); return renderAll(); }
    if (x === "preview") { const f = ctx.frame(), b = t.closest("button"); if (!f) return; b.textContent = "Saving…"; ctx.setPreview(f.id).then(() => renderAll(), err => { b.textContent = err.message || "Couldn't"; }); return; }
    if (x === "picker") { ctx.openPicker(() => renderAll()); return; }
    if (x === "rewording") { st.s.person.text = ""; return changed(); }
    const tab = t.closest("[data-layer]");
    if (tab) { st.layer = tab.dataset.layer; st.add = null; st.notice = null; st.armed = null; st.savedOpen = false; mid.scrollTop = 0; renderAll(); mid.scrollTop = 0; return; }
    const jump = t.closest("[data-jump]");
    if (jump) {
      st.cur[st.layer] = jump.dataset.jump;
      if (st.settings.layout === "all" && !st.q) { const gEl = mid.querySelector(`[data-group="${CSS.escape(jump.dataset.jump)}"]`); listHTML(groupsFor(st.layer)); if (gEl) mid.scrollTo({ top: gEl.offsetTop - mid.offsetTop - 12, behavior: "smooth" }); }
      else { st.q = ""; renderAll(); mid.scrollTop = 0; }
      return;
    }
    const step = t.closest("[data-step]");
    if (step) { const G = groupsFor(st.layer), i = G.findIndex(g => g.k === st.cur[st.layer]) + +step.dataset.step; if (G[i]) { st.cur[st.layer] = G[i].k; renderAll(); mid.scrollTop = 0; } return; }
    const del = t.closest("[data-del]");
    if (del) { const key = del.dataset.del + "|" + del.dataset.dv; if (st.armed === key) deleteMine(del.dataset.del, del.dataset.dv); else { st.armed = key; renderAll(); } return; }
    if (st.armed && !t.closest("[data-sdel]")) st.armed = null;
    const pick = t.closest("[data-g]");
    if (pick) {
      const G = groupsFor(st.layer), g = G.find(x => x.k === pick.dataset.g);
      if (!g) return;
      const v = pick.dataset.v;
      if (!v) g.set(g.multi ? null : "");
      else if (!g.multi && st.layer !== "frame" && isOn(g, v)) g.set("");
      else g.set(v);
      st.cur[st.layer] = g.k;
      if (st.layer === "frame") { renderAll(); return; }
      return changed();
    }
    const more = t.closest("[data-more]");
    if (more) { const id = st.layer + ":" + more.dataset.more; st.exp.has(id) ? st.exp.delete(id) : st.exp.add(id); return renderAll(); }
    const add = t.closest("[data-add]");
    if (add) {
      const kind = add.dataset.addkind || "";
      st.notice = null;
      st.add = st.add && st.add.k === add.dataset.add && (st.add.kind || "") === kind ? null : { k: add.dataset.add, kind };
      renderAll();
      const form = mid.querySelector(`[data-form="${CSS.escape(add.dataset.add)}"]`);
      if (form) { const fr = form.getBoundingClientRect(), mr = mid.getBoundingClientRect(); if (fr.bottom > mr.bottom) mid.scrollTop += fr.bottom - mr.bottom + 16; form.querySelector("input,textarea")?.focus({ preventScroll: true }); }
      return;
    }
    if (t.closest("[data-cancel]")) { st.add = null; return renderAll(); }
    if (t.closest("[data-pickfile]")) { t.closest("form").querySelector("[data-listfile]").click(); return; }
    const col = t.closest("[data-color]");
    if (col) { const [k, c] = col.dataset.color.split(":"); st.s.outfit[k + "C"] = c; st.s.outfit.on = true; return changed(); }
    const sw = t.closest("[data-swap]");
    if (sw) { st.s.outfit.swap = sw.dataset.swap; st.s.outfit.on = true; return changed(); }
    const ov = t.closest("[data-override]");
    if (ov) { const f = ctx.frame(); if (!f) return; const k = ov.dataset.override === "outfit" ? "outfitOverrides" : "sceneOverrides"; const a = (st.s[k] || []).filter(i => i !== f.id); if (!(st.s[k] || []).includes(f.id)) a.push(f.id); st.s[k] = a; return changed(); }
    const use = t.closest("[data-use]");
    if (use) { const L = use.dataset.use; st.s[L].on = st.s[L].on === false; return changed(); }
    if (t.closest("[data-plate]")) { st.s.scene.plate = !st.s.scene.plate; st.s.scene.on = true; return changed(); }
    if (t.closest("[data-skin]")) { const C = st.s.camera; C.skin = !C.skin; C.on = true; return changed(); }
    if (t.closest("[data-style]")) { ctx.setStyle(!ctx.style()); return renderAll(); }
    const un = t.closest("[data-unpick]");
    if (un) { const g = groupsFor(st.layer).find(x => x.k === un.dataset.unpick); if (g) { if (g.multi) g.set(un.dataset.uv); else g.set(""); } return changed(); }
    const setb = t.closest("[data-set]");
    if (setb) { const k = setb.dataset.set; st.settings[k] = !st.settings[k]; saveSettings(st.settings); settingsHTML(); return renderAll(); }
    const load = t.closest("[data-load]");
    if (load) {
      const p = lsList(PRESETS[st.layer])[+load.dataset.load];
      if (p) {
        if (st.layer === "person") st.s.person = { picks: { ...(p.picks || {}) }, text: p.text || "", on: true };
        else st.s[st.layer] = { ...(p.state || {}), on: true };
      }
      st.savedOpen = false; return changed();
    }
    const sdel = t.closest("[data-sdel]");
    if (sdel) { const key = "saved|" + sdel.dataset.sdel; if (st.armed === key) { const a = lsList(PRESETS[st.layer]); a.splice(+sdel.dataset.sdel, 1); lsSet(PRESETS[st.layer], a); st.armed = null; } else st.armed = key; return savedHTML(); }
  });
  el.addEventListener("change", e => {
    const t = e.target;
    if (t.name === "kst-layout") { st.settings.layout = t.value; saveSettings(st.settings); renderAll(); mid.scrollTop = 0; return; }
    if (t.matches("[data-mode]")) { ctx.setMode(t.value); return renderAll(); }
    if (t.matches("[data-listfile]")) {
      const file = t.files && t.files[0]; t.value = "";
      if (file) file.text().then(txt => { const ta = t.closest("form").querySelector("textarea"); ta.value = (ta.value.trim() ? ta.value.trimEnd() + "\n" : "") + txt; countImport(t.closest("form")); });
      return;
    }
  });
  el.addEventListener("input", e => {
    const t = e.target;
    if (t.matches('input[type="color"]')) { t.dataset.touched = "1"; return; }
    if (t.matches("[data-import] textarea")) { countImport(t.form); return; }
    if (t.matches("[data-trigger]")) { ctx.setTrigger(t.value); promptHTML(); return; }
    if (t.matches("#kst-wording")) { const P = st.s.person; const built = personText(P.picks); P.text = t.value.trim() === built ? "" : t.value; P.on = true; save(); promptHTML(); tabsHTML(); return; }
    if (t.matches("[data-search]")) {
      st.q = t.value;
      const G = groupsFor("frame"), pos = t.selectionStart;
      mid.innerHTML = midHTML(G);
      const s = mid.querySelector("[data-search]"); s.focus(); s.setSelectionRange(pos, pos);
      return;
    }
    if (t.matches("[data-filter]")) {
      const qq = t.value.trim().toLowerCase(), w = mid.querySelector(`[data-wrap="${CSS.escape(t.dataset.filter)}"]`);
      let n = 0;
      w.querySelectorAll(":scope > [data-g], :scope > .kst-mine").forEach(node => {
        const b = node.matches("[data-g]") ? node : node.querySelector("[data-g]");
        if (!b.dataset.v) { node.hidden = !!qq; return; }
        const ok = !qq || node.textContent.toLowerCase().includes(qq); node.hidden = !ok; if (ok) n++;
      });
      mid.querySelector(`[data-nomatch="${CSS.escape(t.dataset.filter)}"]`).hidden = n > 0;
    }
  });
  el.addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    if (f.matches("[data-form]")) return submitForm(f);
    if (f.matches("[data-sform]")) {
      const k = PRESETS[st.layer], list = lsList(k), noun = cap(st.layer);
      const name = String(new FormData(f).get("n") || "").trim() || `${noun} ${list.length + 1}`;
      if (st.layer === "person") list.push({ name, picks: { ...st.s.person.picks }, ...(st.s.person.text ? { text: st.s.person.text } : {}) });
      else { const s = { ...st.s[st.layer] }; delete s.on; list.push({ name, state: s, ...(st.layer === "outfit" ? { items: (env.items() || []).filter(i => Object.values(s).flat().includes(i.id)) } : {}) }); }
      lsSet(k, list); savedHTML();
    }
  });
  const onKey = e => {
    if (e.key !== "Escape") return;
    // Something opened over the Studio (Edit prompt, the full picker) handles its own Esc.
    if ([...document.querySelectorAll("body > .kq")].pop() !== el) return;
    if (!q(".kst-menu").hidden) { q(".kst-menu").hidden = true; return; }
    if (st.savedOpen) { st.savedOpen = false; savedHTML(); return; }
    if (st.add) { st.add = null; renderAll(); return; }
    if (e.target.matches && e.target.matches("input, textarea") && e.target.value) return;
    close();
  };
  document.addEventListener("keydown", onKey, true);
  // Keep the canvas from reacting to keys and wheel inside the Studio.
  for (const ev of ["keydown", "keyup", "wheel", "pointerdown"]) el.addEventListener(ev, e => e.stopPropagation());

  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (current && current.el === el) current = null;
    ctx.refresh?.();
  }
  current = { el, close, refresh: renderAll };
  renderAll();
  return current;
}
