// The frame picker: a searchable grid of frames. Click one to select it; the panel on the right
// shows its prompt (editable), what the node will receive, and the buttons that act on it.
import { promptFor, personText, subject, frameNo, loadEdits, saveEdit, withEdit } from "./core.js";
import { withScene, locked as sceneLocked, propOf } from "./scene_core.js";
import { withOutfit, locked as outfitLocked, garmentOf } from "./outfit_core.js";
import { avatarSVG } from "./figure.js";
import { shortPerson } from "./builder.js";
import { saveCustom, deleteCustom, exportCustom, importCustom } from "./custom.js";

const store = {
  get(k) { try { return localStorage.getItem("kps:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("kps:" + k, v); } catch (e) {} },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Quick tags read from the prompt, so cards can be filtered by camera and light at a glance.
const TAGS = {
  camera: [
    ["Overhead", /\b(overhead|top down|directly above|bird's eye)\b/i],
    ["Close-up", /\bclose[- ]?up\b|\bclose medium\b|\btight close\b/i],
    ["Medium", /\bmedium (shot|close|full)\b|\bmedium shot\b/i],
    ["Full length", /\bfull (length|body)\b|\bwide shot\b|\bmedium full\b/i],
    ["Low angle", /\blow angle\b|\bfloor level\b/i],
    ["High angle", /\bhigh angle\b|\blooking down\b/i],
    ["From behind", /\bfrom behind\b|\bseen from behind\b|\bback toward\b/i],
    ["Profile", /\bprofile\b|\bside view\b/i],
    ["Selfie", /\bselfie\b/i],
  ],
  light: [
    ["Flash", /\bflash\b/i],
    ["Window light", /\bwindow (light|sunlight)\b|\bthrough (the )?(window|curtains)\b|\bwindow from\b/i],
    ["Hard sun", /\bhard (window )?sun|\bstrong (afternoon )?(back)?light\b|\bhard afternoon\b|\bdappled\b/i],
    ["Overcast", /\bovercast\b/i],
    ["Golden hour", /\bgolden hour\b|\bsunset\b|\bwarm late\b/i],
    ["Lamp", /\blamp\b|\btungsten\b|\bbulb/i],
    ["Projector", /\bprojector\b|\bprojected\b/i],
    ["Neon", /\bneon\b/i],
    ["Dark / low key", /\blow key\b|\bsilhouette\b|\bdeep shadow|\bnight\b/i],
  ],
};
export function tagsFor(f) {
  const out = { camera: [], light: [] };
  for (const k of Object.keys(TAGS)) for (const [name, re] of TAGS[k]) if (re.test(f.text)) out[k].push(name);
  return out;
}

// The part of the prompt after the "[trigger] in a … photograph," opener: the pose itself.
export function snippet(f) {
  return f.text.replace(/^\[trigger\](,)?( in an? [^,]*,)?\s*/, "").replace(/^./, c => c.toUpperCase());
}

// Where the picker reads and writes trigger, person and edits. The sidebar uses this one (saved in the browser);
// the node passes its own so the picker edits that node's widgets.
export function localCtx() {
  const picks = () => { try { return JSON.parse(store.get("person") || "{}") || {}; } catch (e) { return {}; } };
  return {
    trigger: () => store.get("trigger") || "",
    setTrigger: v => store.set("trigger", v),
    style: () => store.get("styleOn") !== "0",
    person: () => { const p = picks(), on = store.get("personOn") === "1", custom = store.get("personText") || ""; return { picks: p, on, custom, text: on ? (custom || personText(p)) : "" }; },
    setPerson: ({ picks: p, on, text }) => { store.set("person", JSON.stringify(p)); store.set("personOn", on ? "1" : "0"); if (text !== undefined) store.set("personText", text || ""); },
    edits: () => loadEdits(),
    setEdit: (id, text) => saveEdit(id, text),
  };
}

export function thumbHTML(f, thumbs, cls = "") {
  const t = thumbs && thumbs[f.id];
  if (t) return `<img class="kpg-img ${cls}" src="${esc(t)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="kpg-ph ${cls}" aria-hidden="true"><span class="kpg-ph-no">${frameNo(f.id)}</span></div>`;
}

const ICON = {
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  filter: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`,
  image: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6"/></svg>`,
  dice: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  dup: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/><path d="M14.5 12v6M11.5 15h6"/></svg>`,
  down: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>`,
  up: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>`,
  lock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  scene: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>`,
  outfit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3l4 3 4-3 5 4-3 4-2-1v11H8V10l-2 1-3-4z"/></svg>`,
  warn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>`,
};

let open = null;

// openGallery({ data, thumbs, current, ctx, primary, actions, setPreview, openPerson })
//   Click a card to select it. The panel on the right always shows the selected frame:
//   its prompt (editable), what the node will receive, and the buttons.
//   primary: { label, run(frame, btn) } — return true to close the picker.
//   actions: [{ label, icon, run(frame, prompt, btn) }]
//   openPerson(ctx, done): opens the person builder; done() refreshes the picker.
export function openGallery({ data, scenes = null, outfits = null, thumbs = {}, current = null, ctx = localCtx(), primary = null, actions = [], setPreview = null, openPerson = null, onClose = null }) {
  if (open) open.close();
  const TABNAME = Object.fromEntries(data.tabs.map(t => [t.id, t.name]));
  const tagCache = new Map();
  const tagOf = f => { let t = tagCache.get(f.id); if (!t) { t = tagsFor(f); tagCache.set(f.id, t); } return t; };
  let favs = new Set(); try { favs = new Set(JSON.parse(store.get("favs") || "[]")); } catch (e) {}
  const cur = current ? data.frames.find(f => f.id === current) : null;
  const st = {
    q: "", tab: store.get("g:tab") || "all", set: "all", camera: "", light: "", filters: false, portable: !!scenes && store.get("g:portable") === "1",
    sel: cur ? cur.id : null,
  };
  if (cur && st.tab !== "all" && st.tab !== "starred" && cur.tab !== st.tab) st.tab = "all";
  if (st.tab !== "all" && st.tab !== "starred" && !TABNAME[st.tab]) st.tab = "all";

  const el = document.createElement("div");
  el.className = "kq kpg";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Frames");
  el.innerHTML = `
    <div class="kq-box">
      <header class="kq-head">
        <h2>Frames</h2><span class="kq-faint">${data.frames.length}</span>
        <label class="kq-search">${ICON.search}<input type="search" placeholder="Search frames" autocomplete="off" spellcheck="false"></label>
        <span class="kq-grow"></span>
        <span class="kq-trigger"></span>
        <span class="kq-sep"></span>
        <div class="kq-person"></div>
        <span class="kq-sep"></span>
        <button type="button" class="kq-icon" data-x="close" aria-label="Close">${ICON.close}</button>
      </header>
      <div class="kq-tabsrow">
        <div class="kq-tabs" role="tablist"></div>
        <span class="kq-grow"></span>
        <span class="kq-faint kq-count"></span>
        <span class="kq-tabtools"></span>
        ${scenes ? `<button type="button" class="kq-ghost" data-x="portable" title="Only frames whose pose works in any scene">${ICON.scene}<span>Works with scenes</span></button>` : ""}
        <button type="button" class="kq-ghost" data-x="random" title="Pick a random frame from what's shown">${ICON.dice}<span>Random</span></button>
        ${data.hasCustom ? `<button type="button" class="kq-ghost" data-x="newprompt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>New prompt</span></button>` : ""}
        <button type="button" class="kq-ghost" data-x="filters" aria-expanded="false">${ICON.filter}<span>Filter</span></button>
      </div>
      <input type="file" class="kq-file" accept=".json,application/json" hidden>
      <div class="kq-filters" hidden>
        <select data-f="set" aria-label="Set"></select>
        <select data-f="camera" aria-label="Camera"><option value="">Any camera</option>${TAGS.camera.map(([n]) => `<option>${n}</option>`).join("")}</select>
        <select data-f="light" aria-label="Light"><option value="">Any light</option>${TAGS.light.map(([n]) => `<option>${n}</option>`).join("")}</select>
        <button type="button" class="kq-ghost kq-tight" data-x="clearf">Clear</button>
      </div>
      <div class="kq-body">
        <div class="kq-grid" tabindex="-1"></div>
        <aside class="kq-panel" aria-live="polite"></aside>
      </div>
    </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const search = q(".kq-search input");

  let recent = []; try { recent = JSON.parse(store.get("recent") || "[]"); } catch (e) {}
  const markUsed = id => { recent = [id, ...recent.filter(x => x !== id)].slice(0, 40); store.set("recent", JSON.stringify(recent)); };
  const inTab = f => st.tab === "all" || (st.tab === "starred" ? favs.has(f.id) : st.tab === "recent" ? recent.includes(f.id) : f.tab === st.tab);
  const visible = () => {
    const s = st.q.trim().toLowerCase();
    return data.frames.filter(f => inTab(f) && (st.set === "all" || f.set === st.set) && (!st.portable || !sceneLocked(scenes, f)) &&
      (!st.camera || tagOf(f).camera.includes(st.camera)) &&
      (!st.light || tagOf(f).light.includes(st.light)) &&
      (!s || (f.id + " " + f.title + " " + f.text + " " + (data.sets[f.set] || "")).toLowerCase().includes(s)))
      .sort((a, b) => st.tab === "recent" ? recent.indexOf(a.id) - recent.indexOf(b.id) : 0);
  };
  const isCustom = f => !!f && f.tab === "custom";
  let newDraft = null; // a prompt being written in the Custom tab, not saved yet
  const frameById = id => id === "__new" ? newDraft : data.frames.find(x => x.id === id);
  const textOf = f => { if (isCustom(f)) return f.text; const e = ctx.edits()[f.id]; return typeof e === "string" && e.trim() ? e : f.text; };
  const isEdited = f => textOf(f) !== f.text;
  // The scene (from a linked Krea Pose Scene node) and which locked frames use it anyway.
  const sceneNow = () => scenes && ctx.scene ? ctx.scene() : null;
  const overrides = () => ctx.overrides ? ctx.overrides() : [];
  // The outfit (from a linked Call Sheet Outfit node) goes on first, then the scene.
  const outfitNow = () => outfits && ctx.outfit ? ctx.outfit() : null;
  const wearOverrides = () => ctx.outfitOverrides ? ctx.outfitOverrides() : [];
  const sceneFrame = (f, edits) => {
    let fe = withEdit(f, edits);
    const of = outfitNow();
    if (of) { const [text, changed] = withOutfit(outfits, fe, of.parts, wearOverrides()); if (changed) fe = { ...fe, text, bare: undefined }; }
    const sc = sceneNow();
    if (!sc) return fe;
    const [text, changed] = withScene(scenes, fe, sc.parts, overrides());
    return changed ? { ...fe, text, bare: undefined } : fe;
  };
  const promptOf = f => promptFor(sceneFrame(f, ctx.edits()), { trigger: ctx.trigger(), person: ctx.person().text, style: ctx.style() });

  // ----- header: trigger and person -----
  function renderTrigger(editing = false) {
    const box = q(".kq-trigger"), v = ctx.trigger();
    if (editing) {
      box.innerHTML = `<label class="kq-trig-edit"><span>Trigger</span><input type="text" value="${esc(v)}" placeholder="none" autocomplete="off" spellcheck="false" aria-label="LoRA trigger"></label>`;
      const inp = box.querySelector("input");
      let finished = false;
      const done = save => {
        if (finished) return; finished = true;
        if (save) ctx.setTrigger(inp.value.trim());
        setTimeout(() => { renderTrigger(); updateReceive(frameById(st.sel)); }, 0);
      };
      inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") { e.preventDefault(); done(false); } });
      inp.addEventListener("blur", () => done(true), { once: true });
      inp.focus(); inp.select();
      return;
    }
    box.innerHTML = `<button type="button" class="kq-ghost kq-trig" data-x="trigger" title="Your LoRA trigger word. It replaces [trigger] in every prompt."><span class="kq-dim">Trigger</span><span class="${v ? "" : "kq-faint"}">${v ? esc(v) : "none"}</span></button>`;
  }
  function renderPerson() {
    const p = ctx.person();
    const has = Object.values(p.picks || {}).some(Boolean);
    const label = has ? shortPerson(data.traits, p.picks) : (p.text ? p.text : "No person");
    q(".kq-person").innerHTML = `${avatarSVG(has ? p.picks : null, 24)}
      <span class="kq-pp"><span class="${p.on ? "" : "kq-dim"}">${esc(label)}</span><span class="kq-dim">${p.on ? "Added to every prompt" : "Off, not in prompts"}</span></span>
      <button type="button" class="kq-switch" data-x="person" aria-pressed="${p.on}" aria-label="Add this person to prompts"><span></span></button>
      ${openPerson ? `<button type="button" class="kq-ghost kq-tight" data-x="editperson">${has ? "Edit" : "Build"}</button>` : ""}`;
  }

  // ----- tabs, filters, grid -----
  function renderFilters() {
    const tabs = [["all", "All"], ...data.tabs.map(t => [t.id, t.name]), ["starred", "Starred"], ["recent", "Recent"]];
    q(".kq-tabs").innerHTML = tabs.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${esc(name)}</button>`).join("");
    q(".kq-tabtools").innerHTML = st.tab === "custom" && data.hasCustom ? `<button type="button" class="kq-ghost" data-x="import" title="Add prompts from an exported file. Nothing you have is replaced.">${ICON.up}<span>Import</span></button><button type="button" class="kq-ghost" data-x="export" title="Save your custom prompts as a file">${ICON.down}<span>Export</span></button>` : "";
    const tabSets = !data.tabs.some(t => t.id === st.tab) ? data.tabs.flatMap(t => t.sets.map(s => [s, t.name + " · " + data.sets[s]])) : data.tabs.find(t => t.id === st.tab).sets.map(s => [s, data.sets[s]]);
    if (st.set !== "all" && !tabSets.some(([s]) => s === st.set)) st.set = "all";
    q('[data-f="set"]').innerHTML = `<option value="all">All sets</option>` + tabSets.map(([s, n]) => `<option value="${s}"${s === st.set ? " selected" : ""}>${esc(n)}</option>`).join("");
    q('[data-f="camera"]').value = st.camera; q('[data-f="light"]').value = st.light;
    const n = (st.set !== "all") + !!st.camera + !!st.light;
    const fb = q('[data-x="filters"]');
    fb.querySelector("span").textContent = n ? `Filter · ${n}` : "Filter";
    fb.classList.toggle("is-on", !!n);
    fb.setAttribute("aria-expanded", String(st.filters));
    q('[data-x="portable"]')?.classList.toggle("is-on", st.portable);
    q('[data-x="portable"]')?.setAttribute("aria-pressed", String(st.portable));
    q(".kq-filters").hidden = !st.filters;
  }

  function card(f) {
    const tg = tagOf(f);
    const meta = [data.sets[f.set], ...tg.camera.slice(0, 1), ...tg.light.slice(0, 1)].filter(Boolean).join(" · ");
    return `<button type="button" class="kq-card" data-id="${esc(f.id)}" aria-pressed="${f.id === st.sel}" data-tab="${f.tab}">
      ${thumbHTML(f, thumbs)}
      <span class="kq-meta">
        <span class="kq-ctitle"><span class="kq-cname">${esc(f.title)}</span>${scenes && sceneLocked(scenes, f) ? `<span class="kq-lock" title="Keeps its own location: the pose uses ${esc(propOf(scenes, f))}">${ICON.lock}</span>` : ""}${isCustom(f) ? `<span class="kq-cdel" data-del="${esc(f.id)}" role="button" tabindex="-1" title="Delete this prompt" aria-label="Delete ${esc(f.title)}">${ICON.close}</span>` : ""}${isEdited(f) ? '<span class="kq-dot" title="Edited"></span>' : ""}${favs.has(f.id) ? '<span class="kq-fav" title="Starred">★</span>' : ""}</span>
        <span class="kq-cmeta">${frameNo(f.id)} · ${esc(meta)}</span>
        ${thumbs[f.id] ? "" : `<span class="kq-snip">${esc(snippet({ ...f, text: textOf(f) }))}</span>`}
      </span>
    </button>`;
  }

  function renderGrid() {
    const list = visible();
    q(".kq-count").textContent = `${list.length} shown`;
    q(".kq-grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="kq-empty">${st.tab === "starred" && !favs.size ? "Nothing starred yet. Star a frame in the panel to keep it here." : st.tab === "custom" && !st.q && !data.frames.some(isCustom) ? "No custom prompts yet. Press New prompt to write your own, or Import a file." : st.tab === "recent" && !recent.length ? "Frames you use show up here." : "No frames match. Clear the search or a filter."}</div>`;
  }
  const markSelected = () => el.querySelectorAll(".kq-card").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.id === st.sel)));

  // ----- the panel: locked to the selected frame -----
  let draftTimer = null;
  function renderPanel() {
    const box = q(".kq-panel");
    const f = frameById(st.sel);
    if (!f) {
      box.innerHTML = `<div class="kq-none"><p class="kq-strong">No frame selected</p><p class="kq-dim">Pick a frame to edit its prompt here.</p></div>`;
      return;
    }
    const fav = favs.has(f.id), mine = isCustom(f), fresh = f.id === "__new";
    box.innerHTML = `
      <div class="kq-phead">
        ${thumbs[f.id] ? `<img class="kq-pthumb" src="${esc(thumbs[f.id])}" alt="">` : `<span class="kq-pthumb kq-pthumb-empty">${ICON.image}</span>`}
        <div class="kq-ptitle">${mine ? `<input class="kq-titlein" type="text" maxlength="80" placeholder="Name this prompt" value="${esc(fresh ? "" : f.title)}" aria-label="Prompt name">` : `<h3>${esc(f.title)}</h3>`}<span class="kq-dim">${fresh ? "New prompt · saved on this computer" : `${frameNo(f.id)} · ${esc(TABNAME[f.tab] || "")} · ${esc(data.sets[f.set] || "")}`}</span></div>
        ${fresh ? "" : `<button type="button" class="kq-icon kq-star" data-x="star" aria-pressed="${fav}" aria-label="${fav ? "Unstar" : "Star"} this frame">${ICON.star}</button>`}
      </div>
      <div class="kq-pbody">
        ${sceneRow(f, mine, fresh)}
        ${outfitRow(f, fresh)}
        ${ctx.person().on ? `<div class="kq-row kq-plabel"><label for="kq-person" class="kq-strong">Person</label><span class="kq-dim">goes where [trigger] is, in every prompt</span><span class="kq-grow"></span><span class="kq-pedited"></span></div>
        <textarea id="kq-person" class="kq-ptext" rows="2" spellcheck="true"></textarea>` : ""}
        <div class="kq-row kq-plabel"><label for="kq-prompt" class="kq-strong">Prompt</label><span class="kq-edited"></span></div>
        <textarea id="kq-prompt" class="kq-text" spellcheck="true"></textarea>
        <div class="kq-row kq-hint"><span class="kq-faint">Keep [trigger] where your trigger or person should go.</span><span class="kq-grow"></span><span class="kq-words"></span></div>
        <div class="kq-receive"><span class="kq-dim">What the node receives</span><p class="kq-mono"></p></div>
        ${f.note ? `<p class="kq-note"><span class="kq-dim">Why it works.</span> ${esc(f.note)}</p>` : ""}
      </div>
      <div class="kq-pfoot">${fresh ? `
        <button type="button" class="kq-primary" data-x="savenew">Save to Custom</button>
        <div class="kq-row kq-actions"><button type="button" class="kq-ghost" data-x="cancelnew"><span>Cancel</span></button></div>` : `
        ${primary ? `<button type="button" class="kq-primary" data-x="primary">${esc(primary.label)}</button>` : ""}
        <div class="kq-row kq-actions">
          ${setPreview ? `<button type="button" class="kq-ghost kq-wide" data-x="preview">${ICON.image}<span>${thumbs[f.id] ? "Replace preview with last generation" : "Use last generation as preview"}</span></button>` : ""}
          <button type="button" class="kq-ghost" data-x="copy">${ICON.copy}<span>Copy</span></button>
          ${actions.map((a, i) => `<button type="button" class="kq-ghost" data-act="${i}" title="${esc(a.title || "")}">${ICON[a.icon] || ICON.arrow}<span>${esc(a.label)}</span></button>`).join("")}
          ${!mine && data.hasCustom ? `<button type="button" class="kq-ghost" data-x="dup" title="Save a copy of this prompt to your Custom tab">${ICON.dup}<span>Duplicate to Custom</span></button>` : ""}
          ${mine ? `<button type="button" class="kq-ghost kq-danger" data-x="delete"><span>Delete</span></button>` : ""}
        </div>
        <p class="kq-keys kq-faint">Arrow keys move · Enter uses the frame · Esc closes</p>`}
      </div>`;
    const pt = box.querySelector(".kq-ptext");
    if (pt) {
      const pnote = () => { const c = ctx.person().custom; box.querySelector(".kq-pedited").innerHTML = c ? `<span class="kq-accent">Edited</span><button type="button" class="kq-link" data-x="resetperson">Reset</button>` : ""; };
      pt.value = ctx.person().text; pnote();
      pt.addEventListener("input", () => {
        const p = ctx.person(), v = pt.value.trim(), built = personText(p.picks || {});
        ctx.setPerson({ picks: p.picks || {}, on: true, text: v && v !== built ? v : "" });
        pnote(); renderPerson(); updateReceive(f);
      });
      pt.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); pt.blur(); } });
    }
    const ta = box.querySelector("#kq-prompt");
    ta.value = textOf(f);
    ta.addEventListener("input", () => {
      clearTimeout(draftTimer);
      const val = ta.value;
      draftTimer = setTimeout(() => saveDraft(f, val), 200);
      updateDraftBits(f, val);
    });
    ta.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); ta.blur(); } });
    const ti = box.querySelector(".kq-titlein");
    if (ti) {
      ti.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); ta.focus(); } });
      ti.addEventListener("input", () => { if (fresh) return; clearTimeout(draftTimer); draftTimer = setTimeout(() => saveDraft(f, ta.value), 300); });
    }
    updateDraftBits(f, ta.value);
  }
  function sceneRow(f, mine, fresh) {
    if (!scenes || fresh) return "";
    const sc = sceneNow();
    const ov = overrides().includes(f.id), lock = sceneLocked(scenes, f);
    if (mine) {
      return `<div class="kq-scene${f.portable ? "" : " is-muted"}">${f.portable ? ICON.scene : ICON.lock}<span class="kq-grow"><span>${f.portable ? "Works with scenes" : "Keeps its own location"}</span>
        <span class="kq-dim">${f.portable ? "A linked scene replaces the setting in this prompt." : "Turn on if the pose doesn't need anything in its place."}</span></span>
        <button type="button" class="kq-switch" data-x="portableone" aria-pressed="${!!f.portable}" aria-label="Works with scenes"><span></span></button></div>`;
    }
    if (!sc) return "";
    if (sc.parts.plate) {
      return `<div class="kq-scene">${ICON.scene}<span class="kq-grow"><span>Clean plate${sc.label && !(lock && !ov) ? ": " + esc(sc.label) : ""}</span>
        <span class="kq-dim">${lock && !ov ? "This frame's own place, with nobody in it." : "This shot's look in the scene, with nobody in it."}</span></span></div>`;
    }
    if (!lock) return `<div class="kq-scene">${ICON.scene}<span class="kq-grow"><span>Scene${sc.label ? ": " + esc(sc.label) : ""}</span><span class="kq-dim">Replaces this frame's setting. The pose works anywhere.</span></span></div>`;
    if (!ov) return `<div class="kq-scene is-muted">${ICON.lock}<span class="kq-grow"><span>Keeps its own location</span><span class="kq-dim">The pose uses ${esc(propOf(scenes, f))}, so the scene is skipped here.</span></span>
      <button type="button" class="kq-ghost kq-tight kq-filled" data-x="override">Use scene anyway</button></div>`;
    return `<div class="kq-scene is-warn">${ICON.warn}<span class="kq-grow"><span>Scene on, location overridden</span><span class="kq-dim">The pose still mentions ${esc(propOf(scenes, f))}. Check it fits the new place.</span></span>
      <button type="button" class="kq-ghost kq-tight kq-filled" data-x="override">Keep its own</button></div>`;
  }
  function outfitRow(f, fresh) {
    const of = outfitNow();
    if (!of || fresh) return "";
    const ov = wearOverrides().includes(f.id), lock = outfitLocked(outfits, f);
    const what = of.parts.swap === "pick" ? "Swaps only the pieces you picked." : "Replaces what she wears in this frame.";
    if (f.tab === "custom" && lock) return `<div class="kq-scene is-muted">${ICON.lock}<span class="kq-grow"><span>Keeps its own clothes</span><span class="kq-dim">Add a sentence that starts with Wearing to this prompt, and the outfit can change it.</span></span></div>`;
    if (!lock) return `<div class="kq-scene">${ICON.outfit}<span class="kq-grow"><span>Outfit: ${esc(of.label)}</span><span class="kq-dim">${what}</span></span></div>`;
    if (!ov) return `<div class="kq-scene is-muted">${ICON.lock}<span class="kq-grow"><span>Keeps its own clothes</span><span class="kq-dim">The pose uses ${esc(garmentOf(outfits, f))}, so the outfit is skipped here.</span></span>
      <button type="button" class="kq-ghost kq-tight kq-filled" data-x="wearanyway">Use outfit anyway</button></div>`;
    return `<div class="kq-scene is-warn">${ICON.warn}<span class="kq-grow"><span>Outfit on, clothes overridden</span><span class="kq-dim">The pose still mentions ${esc(garmentOf(outfits, f))}. Check it fits the new outfit.</span></span>
      <button type="button" class="kq-ghost kq-tight kq-filled" data-x="wearanyway">Keep its own</button></div>`;
  }
  const refreshCard = f => { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(f.id)}"]`); if (c) c.outerHTML = card(f); };
  function saveDraft(f, val) {
    if (!f || f.id === "__new") return;
    if (isCustom(f)) {
      const title = (q(".kq-titlein")?.value || f.title).trim() || "Untitled";
      if (!val.trim() || (val === f.text && title === f.title)) return;
      saveCustom(data, { id: f.id, title, text: val }).then(() => { refreshCard(f); markSelected(); }, () => {});
      return;
    }
    ctx.setEdit(f.id, val.trim() === f.text.trim() ? "" : val);
    refreshCard(f);
    updateReceive(f);
  }
  function updateDraftBits(f, val) {
    const edited = !isCustom(f) && val.trim() !== f.text.trim();
    const n = val.trim().split(/\s+/).filter(Boolean).length;
    q(".kq-words").textContent = `${n} words${val.includes("[trigger]") ? "" : " · no [trigger]"}`;
    q(".kq-edited").innerHTML = edited ? `<span class="kq-accent">Edited</span><button type="button" class="kq-link" data-x="resetedit">Reset</button>` : "";
    updateReceive(f, val);
  }
  function updateReceive(f, val) {
    const p = q(".kq-receive p"); if (!p || !f) return;
    const ed = { ...ctx.edits() };
    const v = val === undefined ? q(".kq-text")?.value : val;
    if (typeof v === "string") { if (v.trim() && v.trim() !== f.text.trim()) ed[f.id] = v; else delete ed[f.id]; }
    const text = promptFor(sceneFrame(f, ed), { trigger: ctx.trigger(), person: ctx.person().text, style: ctx.style() });
    const subj = subject(ctx.trigger(), ctx.person().text);
    const at = text.indexOf(subj);
    p.innerHTML = at >= 0 && subj !== "[trigger]" ? esc(text.slice(0, at)) + `<mark>${esc(subj)}</mark>` + esc(text.slice(at + subj.length)) : esc(text);
  }

  function select(id, focusCard) {
    if (!id || id === st.sel) return;
    clearTimeout(draftTimer);
    const ta = q(".kq-text"), prev = frameById(st.sel);
    if (ta && prev) saveDraft(prev, ta.value);
    if (st.sel === "__new") newDraft = null;
    st.sel = id; markSelected(); renderPanel();
    if (focusCard) { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(id)}"]`); if (c) { c.focus(); c.scrollIntoView({ block: "nearest" }); } }
  }
  function flushDraft() {
    clearTimeout(draftTimer);
    const ta = q(".kq-text"), f = frameById(st.sel);
    if (ta && f) saveDraft(f, ta.value);
  }
  function close() {
    flushDraft();
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (open && open.el === el) open = null;
    onClose && onClose();
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  }
  function moveSel(delta) {
    const cards = [...el.querySelectorAll(".kq-card")];
    if (!cards.length) return;
    let i = cards.findIndex(c => c.dataset.id === st.sel);
    const cols = Math.max(1, Math.round(q(".kq-grid").clientWidth / cards[0].offsetWidth));
    i = i < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, i + (delta === "row" ? cols : delta === "-row" ? -cols : delta)));
    select(cards[i].dataset.id, true);
  }
  function onKey(e) {
    if (document.querySelector(".kpe, .kq-builder")) return;
    if (e.key === "Escape") {
      e.stopPropagation(); e.preventDefault();
      if (e.target.matches && e.target.matches(".kq-text, .kq-ptext, .kq-trig-edit input, .kq-titlein")) { e.target.blur(); return; }
      close(); return;
    }
    const map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: "row", ArrowUp: "-row" };
    if (map[e.key] !== undefined && e.target.closest && e.target.closest(".kq-grid")) { e.preventDefault(); moveSel(map[e.key]); }
  }
  function flash(btn, text, ms = 1500) {
    const s = btn.querySelector("span") || btn, old = s.textContent;
    s.textContent = text; setTimeout(() => { if (s.isConnected) s.textContent = old; }, ms);
  }

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el) { close(); return; }
    const tb = t.closest(".kq-tabs button");
    if (tb) { st.tab = tb.dataset.tab; store.set("g:tab", st.tab); renderFilters(); renderGrid(); return; }
    const del = t.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      if (!del.classList.contains("is-armed")) {
        el.querySelectorAll(".kq-cdel.is-armed").forEach(d => { d.classList.remove("is-armed"); d.innerHTML = ICON.close; });
        del.classList.add("is-armed"); del.textContent = "Delete?";
        setTimeout(() => { if (del.isConnected && del.classList.contains("is-armed")) { del.classList.remove("is-armed"); del.innerHTML = ICON.close; } }, 3000);
        return;
      }
      const id = del.dataset.del;
      if (st.sel === id) clearTimeout(draftTimer);
      deleteCustom(data, id).then(() => {
        renderGrid();
        if (st.sel === id) st.sel = (visible()[0] || {}).id || null;
        markSelected(); renderPanel();
      });
      return;
    }
    const cd = t.closest(".kq-card");
    if (cd) { select(cd.dataset.id); return; }
    const ac = t.closest("[data-act]");
    if (ac) { flushDraft(); const f = frameById(st.sel); markUsed(f.id); actions[+ac.dataset.act].run(f, promptOf(f), ac); return; }
    const x = t.closest("[data-x]");
    if (!x) return;
    const f = frameById(st.sel);
    switch (x.dataset.x) {
      case "close": close(); break;
      case "newprompt": {
        flushDraft();
        st.tab = "custom"; store.set("g:tab", st.tab); st.q = ""; search.value = "";
        newDraft = { id: "__new", tab: "custom", set: "custom", title: "", text: "[trigger] " };
        st.sel = "__new"; renderFilters(); renderGrid(); renderPanel();
        const ta = q(".kq-text"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        break;
      }
      case "cancelnew": newDraft = null; st.sel = (visible()[0] || {}).id || null; markSelected(); renderPanel(); break;
      case "savenew": {
        const ta = q(".kq-text"), title = q(".kq-titlein").value.trim();
        if (!ta.value.replace("[trigger]", "").trim()) { flash(x, "Write the prompt first"); ta.focus(); break; }
        x.disabled = true;
        saveCustom(data, { title, text: ta.value }).then(nf => { newDraft = null; st.sel = nf.id; renderGrid(); markSelected(); renderPanel(); },
          err => { x.disabled = false; flash(x, err.message || "Couldn't save"); });
        break;
      }
      case "delete": {
        if (!x.dataset.armed) { x.dataset.armed = "1"; flash(x, "Click again to delete", 3000); setTimeout(() => { delete x.dataset.armed; }, 3000); break; }
        clearTimeout(draftTimer);
        deleteCustom(data, f.id).then(() => { st.sel = null; renderGrid(); st.sel = (visible()[0] || {}).id || null; markSelected(); renderPanel(); },
          () => flash(x, "Couldn't delete"));
        break;
      }
      case "filters": st.filters = !st.filters; renderFilters(); break;
      case "portable": st.portable = !st.portable; store.set("g:portable", st.portable ? "1" : "0"); renderFilters(); renderGrid(); markSelected(); break;
      case "override": ctx.setOverride(f.id, !overrides().includes(f.id)); renderPanel(); break;
      case "wearanyway": ctx.setOutfitOverride(f.id, !wearOverrides().includes(f.id)); renderPanel(); break;
      case "portableone": {
        flushDraft(); x.disabled = true;
        saveCustom(data, { id: f.id, title: f.title, text: f.text, portable: !f.portable }).then(() => { refreshCard(f); markSelected(); renderPanel(); if (st.portable) renderGrid(); },
          () => { x.disabled = false; });
        break;
      }
      case "clearf": st.set = "all"; st.camera = ""; st.light = ""; renderFilters(); renderGrid(); break;
      case "trigger": renderTrigger(true); break;
      case "person": {
        const p = ctx.person();
        if (!p.on && !Object.values(p.picks || {}).some(Boolean) && openPerson) { openPerson(ctx, () => { renderPerson(); renderPanel(); }); break; }
        flushDraft(); ctx.setPerson({ picks: p.picks, on: !p.on }); renderPerson(); renderPanel();
        break;
      }
      case "resetperson": { const p = ctx.person(); ctx.setPerson({ picks: p.picks || {}, on: true, text: "" }); renderPerson(); renderPanel(); break; }
      case "editperson": flushDraft(); openPerson(ctx, () => { renderPerson(); renderPanel(); }); break;
      case "star": favs.has(f.id) ? favs.delete(f.id) : favs.add(f.id); store.set("favs", JSON.stringify([...favs])); renderPanel(); if (st.tab === "starred") renderGrid(); else { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(f.id)}"]`); if (c) c.outerHTML = card(f); } break;
      case "resetedit": { const ta = q(".kq-text"); ta.value = f.text; saveDraft(f, f.text); updateDraftBits(f, f.text); ta.focus(); break; }
      case "copy": flushDraft(); markUsed(f.id); navigator.clipboard.writeText(promptOf(f)).then(() => flash(x, "Copied"), () => flash(x, "Press Ctrl+C")); break;
      case "primary": flushDraft(); markUsed(f.id); if (primary.run(f, x)) close(); break;
      case "random": {
        const list = visible().filter(y => y.id !== st.sel);
        if (!list.length) { flash(x, "Nothing to pick"); break; }
        select(list[Math.floor(Math.random() * list.length)].id, true);
        break;
      }
      case "export": { const n = exportCustom(data); flash(x, n ? `Saved ${n}` : "Nothing to export"); break; }
      case "import": q(".kq-file").click(); break;
      case "dup": {
        flushDraft(); x.disabled = true;
        saveCustom(data, { title: f.title + " (copy)", text: textOf(f) }).then(nf => {
          st.tab = "custom"; store.set("g:tab", st.tab); st.set = "all"; st.sel = nf.id; renderFilters(); renderGrid(); markSelected(); renderPanel();
          const c = el.querySelector(`.kq-card[data-id="${CSS.escape(nf.id)}"]`); if (c) c.scrollIntoView({ block: "nearest" });
        }, err => { x.disabled = false; flash(x, err.message || "Couldn't copy"); });
        break;
      }
      case "preview":
        x.disabled = true; flash(x, "Saving…", 600000);
        setPreview(f.id).then(url => { thumbs[f.id] = url; renderGrid(); markSelected(); renderPanel(); },
          err => { x.disabled = false; x.querySelector("span").textContent = err && err.message ? err.message : "Couldn't save preview"; });
        break;
    }
  });
  el.addEventListener("keydown", e => {
    const cd = e.target.closest && e.target.closest(".kq-card");
    if (cd && e.key === " ") { e.preventDefault(); select(cd.dataset.id); }
    if (cd && e.key === "Enter") { e.preventDefault(); select(cd.dataset.id); const b = q('[data-x="primary"]'); if (b) b.click(); else q(".kq-text")?.focus(); }
  });
  el.addEventListener("change", e => {
    if (e.target.classList && e.target.classList.contains("kq-file")) {
      const file = e.target.files && e.target.files[0]; e.target.value = "";
      const btn = q('[data-x="import"]');
      if (!file) return;
      importCustom(data, file).then(n => {
        st.tab = "custom"; renderFilters(); renderGrid(); markSelected();
        const b = q('[data-x="import"]'); if (b) flash(b, n ? `Added ${n}` : "No prompts found", 2500);
      }, err => { if (btn) flash(btn, err.message || "Couldn't import", 3000); });
      return;
    }
    const k = e.target.dataset && e.target.dataset.f;
    if (k) { st[k] = e.target.value; renderFilters(); renderGrid(); }
  });
  el.addEventListener("pointerdown", e => e.stopPropagation());
  search.addEventListener("input", () => { st.q = search.value; renderGrid(); });
  search.addEventListener("keydown", e => e.stopPropagation());
  const returnFocus = document.activeElement;
  document.addEventListener("keydown", onKey, true);

  renderTrigger(); renderPerson(); renderFilters(); renderGrid();
  if (!st.sel) { const first = visible()[0]; if (first) { st.sel = first.id; markSelected(); } }
  renderPanel();
  if (cur) { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(cur.id)}"]`); if (c) c.scrollIntoView({ block: "center" }); }
  search.focus({ preventScroll: true });
  open = { el, close, refresh: () => { renderTrigger(); renderPerson(); renderPanel(); } };
  return open;
}

// A small dialog to rewrite a frame's prompt. onSave(text) gets "" when reset to the sheet's wording.
export function editPrompt({ frame, initial, onSave }) {
  const el = document.createElement("div");
  el.className = "kq kpe";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Edit prompt");
  el.innerHTML = `<div class="kq-box kpe-box">
    <div class="kq-ptitle"><h3>${esc(frame.title)}</h3><span class="kq-dim">${frameNo(frame.id)} · Your version is used everywhere you pick this frame</span></div>
    <textarea class="kq-text kpe-text" spellcheck="true" rows="12"></textarea>
    <div class="kq-row"><span class="kpe-words kq-faint"></span><span class="kq-grow"></span>
      <button type="button" class="kq-ghost" data-x="reset">Reset to sheet text</button>
      <button type="button" class="kq-ghost" data-x="cancel">Cancel</button>
      <button type="button" class="kq-primary kq-sm" data-x="save">Save</button></div>
  </div>`;
  document.body.appendChild(el);
  const ta = el.querySelector("textarea"), words = el.querySelector(".kpe-words");
  ta.value = initial || frame.text;
  const count = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; words.textContent = `${n} words${ta.value.includes("[trigger]") ? "" : " · no [trigger]"}`; };
  ta.addEventListener("input", count); count();
  const close = () => { document.removeEventListener("keydown", onKey, true); el.remove(); };
  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); done(ta.value); }
    else e.stopPropagation(); // keep ComfyUI shortcuts from firing while typing
  };
  const done = text => { const t = text.trim() === frame.text.trim() ? "" : text.trim(); onSave(t); close(); };
  document.addEventListener("keydown", onKey, true);
  el.addEventListener("click", e => {
    const x = e.target.closest("[data-x]");
    if (e.target === el || (x && x.dataset.x === "cancel")) { close(); return; }
    if (x && x.dataset.x === "reset") { ta.value = frame.text; count(); ta.focus(); return; }
    if (x && x.dataset.x === "save") done(ta.value);
  });
  ta.focus();
}
