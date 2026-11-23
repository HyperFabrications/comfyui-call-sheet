// Build a scene: pick a location, time, weather, light, era and mood, or a place (the sheet's Places or your own).
// openSceneBuilder({ data, scenes, state, sample, onChange(state) }). Changes apply as you make them.
import { places as placeList, parts, sceneText, withScene, locked, propOf } from "./scene_core.js";
import { sceneSVG, kindOf, timeOf } from "./scene_art.js";
import { frameNo } from "./core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;
const COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const LOCK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const UP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>`;
const DOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>`;

// ---- your own places (custom_places.json on your computer) ----
const API = "/krea_pose_sheet/places";
export async function loadPlaces() {
  try { const r = await fetch(API, { cache: "no-store" }); if (!r.ok) return null; return (await r.json()).places || []; } catch (e) { return null; }
}
export async function savePlace(p) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save the place");
  return j.place;
}
export async function deletePlace(id) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete the place");
}
async function importPlaces(file) {
  let body;
  try { body = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a places export."); }
  const r = await fetch(`${API}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't import");
  return j;
}
function download(name, obj) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const today = () => new Date().toISOString().slice(0, 10);

// ---- saved scenes (in this browser) ----
const SKEY = "kps:scenes";
const loadSaved = () => { try { const a = JSON.parse(localStorage.getItem(SKEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const storeSaved = a => { try { localStorage.setItem(SKEY, JSON.stringify(a)); } catch (e) {} };

// Ideas for the guided place writer.
const EXAMPLES = [
  { title: "Paris bookshop", kind: "a narrow old Paris bookshop", behind: "floor to ceiling shelves of worn books and a rolling ladder", ground: "creaky wooden floorboards", details: "a brass reading lamp and a sleeping cat on the counter", light: "Warm lamp light mixed with soft daylight from the shop window." },
  { title: "Tokyo alley at night", kind: "a narrow Tokyo side street at night", behind: "glowing paper lanterns, vending machines and stacked neon signs", ground: "wet asphalt reflecting the lights", details: "bicycles leaning on a wall and steam from a ramen shop", light: "Mixed neon and lantern light." },
  { title: "Greek seaside terrace", kind: "a whitewashed terrace above the Aegean Sea", behind: "blue domed rooftops and the open sea", ground: "sun bleached stone tiles", details: "a potted olive tree and pink bougainvillea", light: "Bright late afternoon sun with crisp shadows." },
  { title: "Cozy cabin", kind: "a small log cabin living room", behind: "a crackling stone fireplace and a frosted window", ground: "a thick wool rug over pine floorboards", details: "a stack of firewood and a knit throw on an armchair", light: "Warm firelight and lamp glow." },
];
const TIPS = [
  "Describe the place, not the person. Poses bring their own action.",
  "Name three or four things the camera can see: what's behind, what's underfoot, one small detail.",
  "Leave out furniture the pose would touch. Frames that need a bed or a wall keep their own place anyway.",
  "Light is optional. Leave it empty to keep each frame's own light.",
];
function compose(g) {
  const bits = [g.kind, g.behind && (/\b(behind|around|in the distance|overhead)\b/.test(g.behind) ? g.behind : g.behind + " behind"), g.ground, g.details].map(x => (x || "").trim()).filter(Boolean);
  if (!bits.length) return "";
  const s = bits.join(", ");
  return s[0].toUpperCase() + s.slice(1).replace(/[ .]+$/, "") + ".";
}

let current = null;

export function openSceneBuilder({ data, scenes, state = {}, sample = null, onChange = () => {}, doneLabel = "Done" }) {
  if (current) current.close();
  const C = scenes.categories;
  const st = { cat: C[0].key, mode: "build", s: { on: true, ...state }, mine: [], hasServer: false, ex: 0, edit: null, help: false, naming: false };
  const samples = [sample, ...["S33", "S19", "P5", "S22"].map(id => data.frames.find(f => f.id === id))].filter((f, i, a) => f && a.findIndex(x => x && x.id === f.id) === i);
  const allPlaces = () => placeList(scenes, data.frames, st.mine);
  const placeOf = () => st.s.place ? allPlaces().find(p => p.id === st.s.place) || null : null;
  const optOf = (k, v) => { const c = C.find(x => x.key === k); return c && v ? c.options.find(o => o.value === v) || null : null; };
  const nameOf = (k, v) => (optOf(k, v) || {}).name || "Any";

  const el = document.createElement("div");
  el.className = "kq kq-builder kqs";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Build a scene");
  el.innerHTML = `<div class="kq-box">
    <header class="kq-head">
      <button type="button" class="kq-icon" data-x="close" aria-label="Back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h2>Scene</h2>
      <span class="kq-dim">Replaces the frame's own setting, so any portable pose works anywhere</span>
      <span class="kq-grow"></span>
      <button type="button" class="kq-ghost" data-x="reset">Reset</button>
      <button type="button" class="kq-primary kq-sm" data-x="done">${esc(doneLabel)}</button>
    </header>
    <div class="kqb-body">
      <div class="kqb-left">
        <nav class="kqb-nav" aria-label="Categories"></nav>
        <section class="kqb-presets" aria-label="Saved scenes"></section>
      </div>
      <section class="kqb-opts kqs-mid"></section>
      <aside class="kqb-side">
        <div class="kqb-stage kqs-stage"><div class="kqs-art-box"></div><span class="kqs-badge"></span><div class="kqb-chips"></div></div>
        <div class="kqb-send">
          <div class="kq-row"><span class="kq-strong">Use this scene</span><span class="kq-dim kqs-where"></span><span class="kq-grow"></span>
            <button type="button" class="kq-switch" data-x="on" aria-label="Use this scene in prompts"><span></span></button></div>
          <div class="kq-row"><span>Clean plate</span><span class="kq-dim">the same shot with nobody in it</span><span class="kq-grow"></span>
            <button type="button" class="kq-switch" data-x="plate" aria-label="Clean plate, no person"><span></span></button></div>
          <p class="kq-mono kqb-desc kqs-desc"></p>
          <button type="button" class="kq-ghost kq-tight" data-x="copy">${COPY}<span>Copy</span></button>
        </div>
      </aside>
    </div>
    <input type="file" class="kqs-file" accept=".json,application/json" hidden>
  </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const emit = () => onChange({ ...st.s });
  const P = () => parts(scenes, st.s, allPlaces());

  function set(k, v) {
    st.s = { ...st.s, [k]: v };
    if (!v) delete st.s[k];
    if (k === "location" && v) delete st.s.place;
    if (v && k !== "plate") st.s.on = true;
    emit(); renderNav(); renderMid(); renderSide();
  }

  // ----- left -----
  function renderNav() {
    const pl = placeOf();
    q(".kqb-nav").innerHTML = C.map(c => {
      const v = c.key === "location" && pl ? pl.title : nameOf(c.key, st.s[c.key]);
      const cur = st.mode === "build" && c.key === st.cat;
      return `<button type="button" data-cat="${c.key}" aria-current="${cur}"><span>${esc(c.label)}</span><span class="${v === "Any" ? "kq-faint" : ""}">${esc(v)}</span></button>`;
    }).join("");
  }
  const genericName = list => { let n = list.length + 1; while (list.some(p => p.name === `Scene ${n}`)) n++; return `Scene ${n}`; };
  function renderSaved() {
    const list = loadSaved(), box = q(".kqb-presets");
    const has = Object.keys(st.s).some(k => k !== "on" && st.s[k]);
    box.innerHTML = `<div class="kqb-ph kq-row"><span class="kq-grow">Saved scenes</span>
        <button type="button" class="kq-ghost kq-tight kqs-mini" data-x="simport" title="Add scenes from a file. Nothing you have is replaced.">Import</button>
        <button type="button" class="kq-ghost kq-tight kqs-mini" data-x="sexport" title="Save your scenes as a file">Export</button></div>
      ${list.length ? list.map((p, i) => `<div class="kqb-preset"><button type="button" data-preset="${i}" title="Load ${esc(p.name)}">${esc(p.name)}</button><button type="button" class="kqb-pdel" data-pdel="${i}" aria-label="Delete ${esc(p.name)}">×</button></div>`).join("") : `<p class="kq-faint kqb-pnone">Save a scene to reuse it later.</p>`}
      ${st.naming ? `<label class="kqb-pname"><input type="text" maxlength="40" placeholder="${esc(genericName(list))}" aria-label="Scene name"><button type="button" class="kq-ghost kq-tight kq-filled" data-x="ssave">Save</button></label>`
        : `<button type="button" class="kq-ghost kq-tight kqb-padd" data-x="snew"${has ? "" : " disabled"}>+ Save this scene</button>`}`;
    if (st.naming) {
      const inp = box.querySelector("input");
      inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commitSaved(inp.value); } if (e.key === "Escape") { e.preventDefault(); st.naming = false; renderSaved(); } });
      inp.focus();
    }
  }
  function commitSaved(name) {
    const list = loadSaved();
    const s = { ...st.s }; delete s.on;
    const pl = placeOf();
    list.push({ name: (name || "").trim() || genericName(list), state: s, place: pl && pl.mine ? { title: pl.title, bg: pl.bg, light: pl.light } : undefined });
    storeSaved(list); st.naming = false; renderSaved();
  }

  // ----- middle -----
  function tabs() {
    return `<div class="kqs-tabs" role="tablist" aria-label="Mode">
      <button type="button" role="tab" data-mode="build" aria-selected="${st.mode === "build"}">Build</button>
      <button type="button" role="tab" data-mode="places" aria-selected="${st.mode !== "build"}">Places <span class="kq-faint">${allPlaces().length}</span></button></div>`;
  }
  function example() {
    if (!samples.length) return "";
    const f = samples[st.ex % samples.length], p = P();
    const lock = locked(scenes, f, []);
    const [txt, changed] = withScene(scenes, f, p, []);
    let body;
    if (changed && !p.plate) {
      const swap = [p.bg, p.extra, p.light].filter(Boolean);
      let html = esc(txt);
      for (const s of swap) html = html.replace(esc(s), `<mark>${esc(s)}</mark>`);
      body = html;
    } else body = changed ? `<mark>${esc(txt)}</mark>` : esc(txt);
    const note = !st.s.on ? `<span class="kq-dim">Scene off. Frames keep their own setting.</span>`
      : lock ? `<span class="kqs-lock">${LOCK}<span>${p.plate ? "Keeps its own location, so the clean plate shows that place." : `Keeps its own location: the pose uses ${esc(propOf(scenes, f))}. You can override it per frame in the picker.`}</span></span>` : "";
    return `<div class="kqs-ex">
      <div class="kq-row"><span class="kq-strong">On a frame</span><span class="kq-dim">${frameNo(f.id)} · ${esc(f.title)}</span><span class="kq-grow"></span>
        ${samples.length > 1 ? `<button type="button" class="kq-ghost kq-tight" data-x="nextex">Try another frame</button>` : ""}</div>
      ${note}
      <p class="kqs-extext">${body.replace("[trigger]", '<span class="kq-faint">[trigger]</span>')}</p></div>`;
  }
  function renderMid() {
    const box = q(".kqs-mid");
    if (st.mode === "edit") { renderEditor(box); return; }
    if (st.mode === "places") {
      const pl = allPlaces();
      box.innerHTML = `${tabs()}
        <div class="kq-row kqs-ph"><span class="kq-dim kq-grow">Settings from the Places prompts, and places you write yourself.</span>
          ${st.hasServer ? `<button type="button" class="kq-ghost kq-tight" data-x="pimport" title="Add places from a file. Nothing you have is replaced.">${UP}<span>Import</span></button>
          <button type="button" class="kq-ghost kq-tight" data-x="pexport" title="Save your places as a file">${DOWN}<span>Export</span></button>` : ""}</div>
        <div class="kqs-places">
          ${st.hasServer ? `<button type="button" class="kqs-place kqs-new" data-x="newplace">${PLUS}<span><span class="kq-strong">New place</span><span class="kq-dim">Write your own, with help</span></span></button>` : ""}
          ${pl.map(p => `<div class="kqs-place" role="button" tabindex="0" data-place="${esc(p.id)}" aria-pressed="${st.s.place === p.id}" title="${esc(p.bg)}">
            <span class="kqs-sw">${sceneSVG({}, { kind: kindOf(p.title + " " + p.bg), time: timeOf(p.light + " " + p.bg), plate: true, aria: "" })}</span>
            <span class="kqs-pt"><span class="kqs-pname">${esc(p.title)}${p.mine ? ' <span class="kqs-yours">Yours</span>' : ""}</span><span class="kq-dim">${esc(p.bg)}</span></span>
            ${p.mine ? `<span class="kqs-pact"><button type="button" class="kq-ghost kq-tight" data-pedit="${esc(p.id)}">Edit</button><button type="button" class="kqb-pdel kqs-pdel" data-pdelp="${esc(p.id)}" aria-label="Delete ${esc(p.title)}">×</button></span>` : ""}
          </div>`).join("")}
        </div>
        ${example()}`;
      return;
    }
    const i = C.findIndex(c => c.key === st.cat), c = C[i];
    const pl = placeOf();
    box.innerHTML = `${tabs()}
      <div class="kqb-title"><h3>${esc(c.label)}</h3><span class="kq-dim">${esc(c.key === "location" && pl ? `Using ${pl.title} from Places. Pick one here to switch.` : c.hint || "")}</span></div>
      <div class="kqb-grid">${[{ value: "", name: "Any" }, ...c.options].map(o => {
        const on = (st.s[c.key] || "") === o.value && !(c.key === "location" && pl);
        return `<button type="button" class="kqb-opt" data-val="${esc(o.value)}" aria-pressed="${on}">${o.swatch ? `<span class="kqb-sw" style="background:${o.swatch}"></span>` : ""}<span class="kq-grow">${esc(o.name)}</span>${on ? CHECK : ""}</button>`;
      }).join("")}</div>
      ${example()}
      <div class="kqb-steps">
        <button type="button" class="kq-ghost" data-step="-1">← ${esc(C[(i - 1 + C.length) % C.length].label)}</button>
        <span class="kq-dim kqb-prog">${i + 1} of ${C.length}</span>
        <button type="button" class="kq-ghost kq-filled" data-step="1">${esc(C[(i + 1) % C.length].label)} →</button>
      </div>`;
  }

  // ----- the place editor, with the guided helper -----
  function renderEditor(box) {
    const e = st.edit, g = e.guide;
    box.innerHTML = `${tabs()}
      <div class="kqb-title"><h3>${e.id ? "Edit place" : "New place"}</h3><span class="kq-dim">Saved on this computer, like your custom prompts</span></div>
      <label class="kqs-field"><span class="kq-strong">Name</span><input type="text" data-e="title" maxlength="60" placeholder="Paris bookshop" value="${esc(e.title)}"></label>
      <label class="kqs-field"><span class="kq-row"><span class="kq-strong">Setting</span><span class="kq-dim">What the camera sees around her, in a sentence or two</span></span>
        <textarea data-e="bg" rows="3" placeholder="Floor to ceiling shelves of worn books, a rolling ladder and creaky wooden floorboards.">${esc(e.bg)}</textarea></label>
      <label class="kqs-field"><span class="kq-row"><span class="kq-strong">Light</span><span class="kq-dim">Optional. Replaces the frame's light line</span></span>
        <input type="text" data-e="light" placeholder="Warm lamp light mixed with soft daylight." value="${esc(e.light)}"></label>
      <button type="button" class="kq-ghost kq-tight kqs-helpbtn" data-x="help" aria-expanded="${st.help}">${st.help ? "Hide help" : "Help me write it"}</button>
      ${st.help ? `<div class="kqs-help">
        <p class="kq-dim">Fill in what you know. The setting line writes itself as you type.</p>
        <div class="kqs-ideas"><span class="kq-dim">Start from an idea:</span>${EXAMPLES.map((x, i) => `<button type="button" class="kq-chip" data-idea="${i}">${esc(x.title)}</button>`).join("")}</div>
        <label class="kqs-field"><span>What kind of place?</span><input type="text" data-g="kind" placeholder="a narrow old Paris bookshop" value="${esc(g.kind)}"></label>
        <label class="kqs-field"><span>What's behind her?</span><input type="text" data-g="behind" placeholder="shelves of worn books and a rolling ladder" value="${esc(g.behind)}"></label>
        <label class="kqs-field"><span>What's underfoot?</span><input type="text" data-g="ground" placeholder="creaky wooden floorboards" value="${esc(g.ground)}"></label>
        <label class="kqs-field"><span>One or two small details</span><input type="text" data-g="details" placeholder="a brass lamp and a sleeping cat on the counter" value="${esc(g.details)}"></label>
        <ul class="kqs-tips">${TIPS.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>` : ""}
      <div class="kq-row kqs-efoot"><span class="kq-dim kqs-emsg"></span><span class="kq-grow"></span>
        <button type="button" class="kq-ghost" data-x="ecancel">Cancel</button>
        <button type="button" class="kq-primary kq-sm" data-x="esave">${e.id ? "Save place" : "Save and use"}</button></div>`;
    box.querySelectorAll("input, textarea").forEach(inp => {
      inp.addEventListener("keydown", ev => ev.stopPropagation());
      inp.addEventListener("input", () => {
        if (inp.dataset.e) e[inp.dataset.e] = inp.value;
        if (inp.dataset.g) { g[inp.dataset.g] = inp.value; e.bg = compose(g); const t = box.querySelector('[data-e="bg"]'); if (t) t.value = e.bg; }
        renderSide();
      });
    });
  }
  function startEdit(p) {
    st.edit = { id: p ? p.id : "", title: p ? p.title : "", bg: p ? p.bg : "", light: p ? p.light : "", guide: { kind: "", behind: "", ground: "", details: "" } };
    st.help = !p; st.mode = "edit"; renderNav(); renderMid(); renderSide();
    q('[data-e="title"]')?.focus();
  }

  // ----- right -----
  function renderSide() {
    const p = P(), pl = placeOf();
    const ed = st.mode === "edit" ? st.edit : null;
    const loc = optOf("location", st.s.location);
    const kind = ed ? kindOf(ed.title + " " + ed.bg) : pl ? kindOf(pl.title + " " + pl.bg) : loc ? loc.kind : "none";
    const time = ed ? timeOf(ed.light + " " + ed.bg) : pl ? timeOf(pl.light + " " + pl.bg) : "";
    const label = ed ? (ed.title || "New place") : st.s.plate ? "Clean plate" + (p.label ? " · " + p.label : "") : p.label || "Frame's own setting";
    q(".kqs-art-box").innerHTML = sceneSVG(st.s, { kind, time, on: st.s.on, plate: !!st.s.plate, aria: label });
    q(".kqs-badge").textContent = label;
    q(".kqb-chips").innerHTML = ed ? "" : [pl ? [pl.title, "place"] : null, ...C.filter(c => st.s[c.key] && !(c.key === "location" && pl)).map(c => [nameOf(c.key, st.s[c.key]), c.key])].filter(Boolean)
      .map(([t, k]) => `<button type="button" class="kq-chip" data-clear="${k}" aria-label="Clear ${esc(t)}">${esc(t)}<span aria-hidden="true">×</span></button>`).join("");
    q('[data-x="on"]').setAttribute("aria-pressed", String(st.s.on !== false));
    q('[data-x="plate"]').setAttribute("aria-pressed", String(!!st.s.plate));
    q(".kqs-where").textContent = st.s.on === false ? "off, frames keep their own setting" : "on portable frames";
    const d = q(".kqs-desc");
    const txt = ed ? [ed.bg, ed.light].filter(Boolean).join(" ") : sceneText(p);
    d.classList.toggle("is-off", st.s.on === false);
    d.innerHTML = txt ? esc(txt) : `<span class="kq-faint">Pick a location, a place or a time of day to start.</span>`;
  }
  const renderAll = () => { renderNav(); renderSaved(); renderMid(); renderSide(); };

  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (current && current.el === el) current = null;
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (st.mode === "edit") { st.mode = "places"; renderMid(); renderSide(); } else close(); }
  }
  function flash(btn, text, ms = 1600) {
    const s = btn.querySelector("span") || btn, old = s.textContent;
    s.textContent = text; setTimeout(() => { if (s.isConnected) s.textContent = old; }, ms);
  }
  let fileFor = "";

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el) { close(); return; }
    const md = t.closest("[data-mode]");
    if (md) { st.mode = md.dataset.mode; renderNav(); renderMid(); renderSide(); return; }
    const pe = t.closest("[data-pedit]");
    if (pe) { e.stopPropagation(); startEdit(st.mine.find(p => p.id === pe.dataset.pedit)); return; }
    const pdp = t.closest("[data-pdelp]");
    if (pdp) {
      e.stopPropagation();
      if (!pdp.classList.contains("is-armed")) { pdp.classList.add("is-armed"); pdp.textContent = "Delete?"; setTimeout(() => { if (pdp.isConnected) { pdp.classList.remove("is-armed"); pdp.textContent = "×"; } }, 3000); return; }
      const id = pdp.dataset.pdelp;
      deletePlace(id).then(() => { st.mine = st.mine.filter(p => p.id !== id); if (st.s.place === id) { delete st.s.place; emit(); } renderAll(); }, () => flash(pdp, "Couldn't"));
      return;
    }
    const pc = t.closest("[data-place]");
    if (pc) { const id = pc.dataset.place; st.s = { ...st.s, place: st.s.place === id ? undefined : id, on: true }; if (!st.s.place) delete st.s.place; else delete st.s.location; emit(); renderNav(); renderMid(); renderSide(); return; }
    const idea = t.closest("[data-idea]");
    if (idea) {
      const x = EXAMPLES[+idea.dataset.idea];
      st.edit.guide = { kind: x.kind, behind: x.behind, ground: x.ground, details: x.details };
      st.edit.bg = compose(st.edit.guide); st.edit.light = x.light; if (!st.edit.title) st.edit.title = x.title;
      renderMid(); renderSide(); return;
    }
    const x = t.closest("[data-x]");
    if (x) {
      const k = x.dataset.x;
      if (k === "close") close();
      else if (k === "done") { emit(); close(); }
      else if (k === "reset") { st.s = { on: true }; emit(); renderAll(); }
      else if (k === "on") { st.s.on = st.s.on === false; emit(); renderSide(); renderMid(); }
      else if (k === "plate") { st.s.plate = !st.s.plate; if (!st.s.plate) delete st.s.plate; else st.s.on = true; emit(); renderSide(); renderMid(); }
      else if (k === "copy") {
        const txt = sceneText(P()), lbl = x.querySelector("span");
        if (txt) navigator.clipboard.writeText(txt).then(() => { lbl.textContent = "Copied"; setTimeout(() => { lbl.textContent = "Copy"; }, 1400); }, () => { lbl.textContent = "Press Ctrl+C"; });
      }
      else if (k === "nextex") { st.ex++; renderMid(); }
      else if (k === "snew") { st.naming = true; renderSaved(); }
      else if (k === "ssave") commitSaved(q(".kqb-pname input").value);
      else if (k === "sexport") { const list = loadSaved(); if (!list.length) { flash(x, "Nothing yet"); return; } download(`krea-scenes-${today()}.json`, { kind: "krea-pose-sheet-scenes", version: 1, scenes: list }); flash(x, `Saved ${list.length}`); }
      else if (k === "simport") { fileFor = "scenes"; q(".kqs-file").click(); }
      else if (k === "pexport") { if (!st.mine.length) { flash(x, "No places yet"); return; } download(`krea-places-${today()}.json`, { kind: "krea-pose-sheet-places", version: 1, places: st.mine.map(({ title, bg, light }) => ({ title, bg, light })) }); flash(x, `Saved ${st.mine.length}`); }
      else if (k === "pimport") { fileFor = "places"; q(".kqs-file").click(); }
      else if (k === "newplace") startEdit(null);
      else if (k === "help") { st.help = !st.help; renderMid(); }
      else if (k === "ecancel") { st.mode = "places"; renderNav(); renderMid(); renderSide(); }
      else if (k === "esave") {
        const ed = st.edit;
        if (!ed.bg.trim()) { q(".kqs-emsg").textContent = "Write the setting first, or use Help me write it."; q('[data-e="bg"]').focus(); return; }
        x.disabled = true;
        savePlace({ id: ed.id, title: ed.title || "Untitled place", bg: ed.bg, light: ed.light }).then(p => {
          const i = st.mine.findIndex(m => m.id === p.id);
          if (i >= 0) st.mine[i] = p; else st.mine.push(p);
          st.s = { ...st.s, place: p.id, on: true }; delete st.s.location;
          st.mode = "places"; emit(); renderAll();
        }, err => { x.disabled = false; q(".kqs-emsg").textContent = err.message || "Couldn't save"; });
      }
      return;
    }
    const pr = t.closest("[data-preset]");
    if (pr) {
      const p = loadSaved()[+pr.dataset.preset];
      if (!p) return;
      const s = { ...p.state, on: true };
      // A saved scene that used your own place: find it, or add it back if it was deleted or came from someone else.
      if (p.place && s.place) {
        const hit = st.mine.find(m => m.bg === p.place.bg);
        if (hit) { s.place = hit.id; st.s = s; emit(); renderAll(); }
        else if (st.hasServer) savePlace(p.place).then(np => { st.mine.push(np); s.place = np.id; st.s = s; emit(); renderAll(); }, () => {});
        return;
      }
      st.s = s; emit(); renderAll(); return;
    }
    const pd = t.closest("[data-pdel]");
    if (pd) {
      if (!pd.classList.contains("is-armed")) { pd.classList.add("is-armed"); pd.textContent = "Delete?"; setTimeout(() => { if (pd.isConnected) { pd.classList.remove("is-armed"); pd.textContent = "×"; } }, 3000); return; }
      const list = loadSaved(); list.splice(+pd.dataset.pdel, 1); storeSaved(list); renderSaved(); return;
    }
    const c = t.closest("[data-cat]");
    if (c) { st.cat = c.dataset.cat; st.mode = "build"; renderNav(); renderMid(); return; }
    const o = t.closest("[data-val]");
    if (o) { set(st.cat, o.dataset.val); return; }
    const s = t.closest("[data-step]");
    if (s) { const i = C.findIndex(x => x.key === st.cat); st.cat = C[(i + +s.dataset.step + C.length) % C.length].key; renderNav(); renderMid(); return; }
    const cl = t.closest("[data-clear]");
    if (cl) { if (cl.dataset.clear === "place") { delete st.s.place; emit(); renderNav(); renderMid(); renderSide(); } else set(cl.dataset.clear, ""); }
  });
  el.addEventListener("keydown", e => {
    const pc = e.target.closest && e.target.closest("[data-place]");
    if (pc && (e.key === "Enter" || e.key === " ") && e.target === pc) { e.preventDefault(); pc.click(); }
  });
  el.addEventListener("change", e => {
    if (!e.target.classList.contains("kqs-file")) return;
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (fileFor === "places") {
      const btn = q('[data-x="pimport"]');
      importPlaces(file).then(j => { st.mine = j.places; renderAll(); const b = q('[data-x="pimport"]'); if (b) flash(b, j.added ? `Added ${j.added}` : "No places found", 2500); },
        err => { if (btn) flash(btn, err.message || "Couldn't import", 3000); });
    } else {
      const btn = q('[data-x="simport"]');
      file.text().then(txt => {
        const j = JSON.parse(txt), items = Array.isArray(j) ? j : j.scenes;
        if (!Array.isArray(items)) throw new Error();
        const list = loadSaved();
        let n = 0;
        for (const x of items) if (x && typeof x === "object" && x.state && typeof x.state === "object") { list.push({ name: String(x.name || "").slice(0, 40) || genericName(list), state: x.state, place: x.place }); n++; }
        storeSaved(list); renderSaved();
        const b = q('[data-x="simport"]'); if (b) flash(b, n ? `Added ${n}` : "None found", 2500);
      }).catch(() => { if (btn) flash(btn, "Not a scenes file", 3000); });
    }
  });
  el.addEventListener("pointerdown", e => e.stopPropagation());
  document.addEventListener("keydown", onKey, true);
  renderAll();
  loadPlaces().then(list => { if (list) { st.mine = list; st.hasServer = true; renderAll(); } });
  q(".kqb-nav button[aria-current=true]")?.focus({ preventScroll: true });
  current = { el, close };
  return current;
}
