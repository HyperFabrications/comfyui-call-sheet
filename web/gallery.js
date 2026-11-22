// The frame picker: a searchable grid of frames. Click one to select it; the panel on the right
// shows its prompt (editable), what the node will receive, and the buttons that act on it.
import { promptFor, personText, subject, frameNo, loadEdits, saveEdit } from "./core.js";
import { avatarSVG } from "./figure.js";
import { shortPerson } from "./builder.js";

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
    person: () => { const p = picks(), on = store.get("personOn") === "1"; return { picks: p, on, text: on ? personText(p) : "" }; },
    setPerson: ({ picks: p, on }) => { store.set("person", JSON.stringify(p)); store.set("personOn", on ? "1" : "0"); },
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
  star: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>`,
};

let open = null;

// openGallery({ data, thumbs, current, ctx, primary, actions, setPreview, openPerson })
//   Click a card to select it. The panel on the right always shows the selected frame:
//   its prompt (editable), what the node will receive, and the buttons.
//   primary: { label, run(frame, btn) } — return true to close the picker.
//   actions: [{ label, icon, run(frame, prompt, btn) }]
//   openPerson(ctx, done): opens the person builder; done() refreshes the picker.
export function openGallery({ data, thumbs = {}, current = null, ctx = localCtx(), primary = null, actions = [], setPreview = null, openPerson = null, onClose = null }) {
  if (open) open.close();
  const TABNAME = Object.fromEntries(data.tabs.map(t => [t.id, t.name]));
  const tagCache = new Map(data.frames.map(f => [f.id, tagsFor(f)]));
  let favs = new Set(); try { favs = new Set(JSON.parse(store.get("favs") || "[]")); } catch (e) {}
  const cur = current ? data.frames.find(f => f.id === current) : null;
  const st = {
    q: "", tab: store.get("g:tab") || "all", set: "all", camera: "", light: "", filters: false,
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
        <button type="button" class="kq-ghost" data-x="filters" aria-expanded="false">${ICON.filter}<span>Filter</span></button>
      </div>
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

  const inTab = f => st.tab === "all" || (st.tab === "starred" ? favs.has(f.id) : f.tab === st.tab);
  const visible = () => {
    const s = st.q.trim().toLowerCase();
    return data.frames.filter(f => inTab(f) && (st.set === "all" || f.set === st.set) &&
      (!st.camera || tagCache.get(f.id).camera.includes(st.camera)) &&
      (!st.light || tagCache.get(f.id).light.includes(st.light)) &&
      (!s || (f.id + " " + f.title + " " + f.text + " " + (data.sets[f.set] || "")).toLowerCase().includes(s)));
  };
  const textOf = f => { const e = ctx.edits()[f.id]; return typeof e === "string" && e.trim() ? e : f.text; };
  const isEdited = f => textOf(f) !== f.text;
  const promptOf = f => promptFor(f, { trigger: ctx.trigger(), person: ctx.person().text, style: ctx.style(), edits: ctx.edits() });

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
        setTimeout(() => { renderTrigger(); updateReceive(data.frames.find(x => x.id === st.sel)); }, 0);
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
    const tabs = [["all", "All"], ...data.tabs.map(t => [t.id, t.name]), ["starred", "Starred"]];
    q(".kq-tabs").innerHTML = tabs.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${esc(name)}</button>`).join("");
    const tabSets = st.tab === "all" || st.tab === "starred" ? data.tabs.flatMap(t => t.sets.map(s => [s, t.name + " · " + data.sets[s]])) : data.tabs.find(t => t.id === st.tab).sets.map(s => [s, data.sets[s]]);
    if (st.set !== "all" && !tabSets.some(([s]) => s === st.set)) st.set = "all";
    q('[data-f="set"]').innerHTML = `<option value="all">All sets</option>` + tabSets.map(([s, n]) => `<option value="${s}"${s === st.set ? " selected" : ""}>${esc(n)}</option>`).join("");
    q('[data-f="camera"]').value = st.camera; q('[data-f="light"]').value = st.light;
    const n = (st.set !== "all") + !!st.camera + !!st.light;
    const fb = q('[data-x="filters"]');
    fb.querySelector("span").textContent = n ? `Filter · ${n}` : "Filter";
    fb.classList.toggle("is-on", !!n);
    fb.setAttribute("aria-expanded", String(st.filters));
    q(".kq-filters").hidden = !st.filters;
  }

  function card(f) {
    const tg = tagCache.get(f.id);
    const meta = [data.sets[f.set], ...tg.camera.slice(0, 1), ...tg.light.slice(0, 1)].filter(Boolean).join(" · ");
    return `<button type="button" class="kq-card" data-id="${esc(f.id)}" aria-pressed="${f.id === st.sel}" data-tab="${f.tab}">
      ${thumbHTML(f, thumbs)}
      <span class="kq-meta">
        <span class="kq-ctitle"><span class="kq-cname">${esc(f.title)}</span>${isEdited(f) ? '<span class="kq-dot" title="Edited"></span>' : ""}${favs.has(f.id) ? '<span class="kq-fav" title="Starred">★</span>' : ""}</span>
        <span class="kq-cmeta">${frameNo(f.id)} · ${esc(meta)}</span>
        ${thumbs[f.id] ? "" : `<span class="kq-snip">${esc(snippet({ ...f, text: textOf(f) }))}</span>`}
      </span>
    </button>`;
  }

  function renderGrid() {
    const list = visible();
    q(".kq-count").textContent = `${list.length} shown`;
    q(".kq-grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="kq-empty">${st.tab === "starred" && !favs.size ? "Nothing starred yet. Star a frame in the panel to keep it here." : "No frames match. Clear the search or a filter."}</div>`;
  }
  const markSelected = () => el.querySelectorAll(".kq-card").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.id === st.sel)));

  // ----- the panel: locked to the selected frame -----
  let draftTimer = null;
  function renderPanel() {
    const box = q(".kq-panel");
    const f = data.frames.find(x => x.id === st.sel);
    if (!f) {
      box.innerHTML = `<div class="kq-none"><p class="kq-strong">No frame selected</p><p class="kq-dim">Pick a frame to edit its prompt here.</p></div>`;
      return;
    }
    const fav = favs.has(f.id);
    box.innerHTML = `
      <div class="kq-phead">
        ${thumbs[f.id] ? `<img class="kq-pthumb" src="${esc(thumbs[f.id])}" alt="">` : `<span class="kq-pthumb kq-pthumb-empty">${ICON.image}</span>`}
        <div class="kq-ptitle"><h3>${esc(f.title)}</h3><span class="kq-dim">${frameNo(f.id)} · ${esc(TABNAME[f.tab] || "")} · ${esc(data.sets[f.set] || "")}</span></div>
        <button type="button" class="kq-icon kq-star" data-x="star" aria-pressed="${fav}" aria-label="${fav ? "Unstar" : "Star"} this frame">${ICON.star}</button>
      </div>
      <div class="kq-pbody">
        <div class="kq-row kq-plabel"><label for="kq-prompt" class="kq-strong">Prompt</label><span class="kq-edited"></span><span class="kq-grow"></span><span class="kq-faint kq-words"></span></div>
        <textarea id="kq-prompt" class="kq-text" spellcheck="true"></textarea>
        <p class="kq-hint kq-faint">Keep [trigger] where your trigger or person should go.</p>
        <div class="kq-receive"><span class="kq-dim">What the node receives</span><p class="kq-mono"></p></div>
        ${f.note ? `<p class="kq-note"><span class="kq-dim">Why it works.</span> ${esc(f.note)}</p>` : ""}
      </div>
      <div class="kq-pfoot">
        ${primary ? `<button type="button" class="kq-primary" data-x="primary">${esc(primary.label)}</button>` : ""}
        <div class="kq-row kq-actions">
          ${setPreview ? `<button type="button" class="kq-ghost kq-wide" data-x="preview">${ICON.image}<span>${thumbs[f.id] ? "Replace preview with last generation" : "Use last generation as preview"}</span></button>` : ""}
          <button type="button" class="kq-ghost" data-x="copy">${ICON.copy}<span>Copy</span></button>
          ${actions.map((a, i) => `<button type="button" class="kq-ghost" data-act="${i}" title="${esc(a.title || "")}">${ICON[a.icon] || ICON.arrow}<span>${esc(a.label)}</span></button>`).join("")}
        </div>
      </div>`;
    const ta = box.querySelector("textarea");
    ta.value = textOf(f);
    ta.addEventListener("input", () => {
      clearTimeout(draftTimer);
      const val = ta.value;
      draftTimer = setTimeout(() => saveDraft(f, val), 200);
      updateDraftBits(f, val);
    });
    ta.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); ta.blur(); } });
    updateDraftBits(f, ta.value);
  }
  function saveDraft(f, val) {
    ctx.setEdit(f.id, val.trim() === f.text.trim() ? "" : val);
    const c = el.querySelector(`.kq-card[data-id="${CSS.escape(f.id)}"]`);
    if (c) c.outerHTML = card(f);
    updateReceive(f);
  }
  function updateDraftBits(f, val) {
    const edited = val.trim() !== f.text.trim();
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
    const text = promptFor(f, { trigger: ctx.trigger(), person: ctx.person().text, style: ctx.style(), edits: ed });
    const subj = subject(ctx.trigger(), ctx.person().text);
    const at = text.indexOf(subj);
    p.innerHTML = at >= 0 && subj !== "[trigger]" ? esc(text.slice(0, at)) + `<mark>${esc(subj)}</mark>` + esc(text.slice(at + subj.length)) : esc(text);
  }

  function select(id, focusCard) {
    if (!id || id === st.sel) return;
    clearTimeout(draftTimer);
    const ta = q(".kq-text"), prev = data.frames.find(x => x.id === st.sel);
    if (ta && prev) saveDraft(prev, ta.value);
    st.sel = id; markSelected(); renderPanel();
    if (focusCard) { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(id)}"]`); if (c) { c.focus(); c.scrollIntoView({ block: "nearest" }); } }
  }
  function flushDraft() {
    clearTimeout(draftTimer);
    const ta = q(".kq-text"), f = data.frames.find(x => x.id === st.sel);
    if (ta && f) ctx.setEdit(f.id, ta.value.trim() === f.text.trim() ? "" : ta.value);
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
      if (e.target.matches && e.target.matches(".kq-text, .kq-trig-edit input")) { e.target.blur(); return; }
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
    const cd = t.closest(".kq-card");
    if (cd) { select(cd.dataset.id); return; }
    const ac = t.closest("[data-act]");
    if (ac) { flushDraft(); const f = data.frames.find(x => x.id === st.sel); actions[+ac.dataset.act].run(f, promptOf(f), ac); return; }
    const x = t.closest("[data-x]");
    if (!x) return;
    const f = data.frames.find(y => y.id === st.sel);
    switch (x.dataset.x) {
      case "close": close(); break;
      case "filters": st.filters = !st.filters; renderFilters(); break;
      case "clearf": st.set = "all"; st.camera = ""; st.light = ""; renderFilters(); renderGrid(); break;
      case "trigger": renderTrigger(true); break;
      case "person": {
        const p = ctx.person();
        if (!p.on && !Object.values(p.picks || {}).some(Boolean) && openPerson) { openPerson(ctx, () => { renderPerson(); renderPanel(); }); break; }
        ctx.setPerson({ picks: p.picks, on: !p.on }); renderPerson(); updateReceive(f);
        break;
      }
      case "editperson": flushDraft(); openPerson(ctx, () => { renderPerson(); renderPanel(); }); break;
      case "star": favs.has(f.id) ? favs.delete(f.id) : favs.add(f.id); store.set("favs", JSON.stringify([...favs])); renderPanel(); if (st.tab === "starred") renderGrid(); else { const c = el.querySelector(`.kq-card[data-id="${CSS.escape(f.id)}"]`); if (c) c.outerHTML = card(f); } break;
      case "resetedit": { const ta = q(".kq-text"); ta.value = f.text; saveDraft(f, f.text); updateDraftBits(f, f.text); ta.focus(); break; }
      case "copy": flushDraft(); navigator.clipboard.writeText(promptOf(f)).then(() => flash(x, "Copied"), () => flash(x, "Press Ctrl+C")); break;
      case "primary": flushDraft(); if (primary.run(f, x)) close(); break;
      case "preview":
        x.disabled = true; flash(x, "Saving…", 600000);
        setPreview(f.id).then(url => { thumbs[f.id] = url; renderGrid(); markSelected(); renderPanel(); },
          err => { x.disabled = false; x.querySelector("span").textContent = err && err.message ? err.message : "Couldn't save preview"; });
        break;
    }
  });
  el.addEventListener("keydown", e => {
    const cd = e.target.closest && e.target.closest(".kq-card");
    if (cd && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(cd.dataset.id); q(".kq-text")?.focus(); }
  });
  el.addEventListener("change", e => {
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
