// Full screen frame gallery: a searchable, filterable grid of cards with a detail panel.
// openGallery({ data, thumbs, current, onPick, actions }) — onPick set means "pick mode" (click a card to choose it).
import { promptFor, personText, frameNo, loadEdits, saveEdit } from "./core.js";

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

function settings() {
  let person = {}; try { person = JSON.parse(store.get("person") || "{}"); } catch (e) {}
  return {
    edits: loadEdits(),
    trigger: store.get("trigger") || "",
    style: store.get("styleOn") !== "0",
    person: store.get("personOn") === "1" ? personText(person) : "",
  };
}

export function thumbHTML(f, thumbs, cls = "") {
  const t = thumbs && thumbs[f.id];
  if (t) return `<img class="kpg-img ${cls}" src="${esc(t)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="kpg-ph ${cls}" aria-hidden="true"><span class="kpg-ph-no">${frameNo(f.id)}</span><span class="kpg-ph-set">${esc(f.set)}</span></div>`;
}

let open = null;

export function openGallery({ data, thumbs = {}, current = null, onPick = null, actions = [], setPreview = null }) {
  if (open) open.close();
  const picking = typeof onPick === "function";
  const TABNAME = Object.fromEntries(data.tabs.map(t => [t.id, t.name]));
  const tagCache = new Map(data.frames.map(f => [f.id, tagsFor(f)]));
  let favs = new Set(); try { favs = new Set(JSON.parse(store.get("favs") || "[]")); } catch (e) {}
  let edited = loadEdits();
  const cur = current ? data.frames.find(f => f.id === current) : null;
  const st = {
    q: "", tab: store.get("g:tab") || (cur ? cur.tab : "all"), set: "all", camera: "", light: "", starred: false,
    focus: cur ? cur.id : null,
  };
  if (st.tab !== "all" && !TABNAME[st.tab]) st.tab = "all";

  const el = document.createElement("div");
  el.className = "kps kpg";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", picking ? "Pick a frame" : "Pose gallery");
  el.innerHTML = `
    <div class="kpg-box">
      <div class="kpg-head">
        <h2>${picking ? "Pick a frame" : "Pose gallery"}</h2>
        <label class="kps-field kpg-search"><span>Find</span><input type="search" placeholder="window, mirror, overhead…" autocomplete="off"></label>
        <span class="kpg-count kps-muted"></span>
        <button type="button" class="kps-btn kpg-close" aria-label="Close">Close</button>
      </div>
      <div class="kpg-filters">
        <div class="kpg-tabs" role="tablist"></div>
        <div class="kps-row">
          <select class="kpg-sel" data-f="set" aria-label="Set"></select>
          <select class="kpg-sel" data-f="camera" aria-label="Camera"><option value="">Any camera</option>${TAGS.camera.map(([n]) => `<option>${n}</option>`).join("")}</select>
          <select class="kpg-sel" data-f="light" aria-label="Light"><option value="">Any light</option>${TAGS.light.map(([n]) => `<option>${n}</option>`).join("")}</select>
          <button type="button" class="kps-toggle kpg-star-only" aria-pressed="false"><span class="kps-sw"></span><span>★ Starred only</span></button>
        </div>
      </div>
      <div class="kpg-body">
        <div class="kpg-grid" tabindex="-1"></div>
        <aside class="kpg-detail" aria-live="polite"></aside>
      </div>
    </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const search = q(".kpg-search input");

  const inTab = f => st.tab === "all" || f.tab === st.tab;
  const visible = () => {
    const s = st.q.trim().toLowerCase();
    return data.frames.filter(f => inTab(f) && (st.set === "all" || f.set === st.set) &&
      (!st.camera || tagCache.get(f.id).camera.includes(st.camera)) &&
      (!st.light || tagCache.get(f.id).light.includes(st.light)) &&
      (!st.starred || favs.has(f.id)) &&
      (!s || (f.id + " " + f.title + " " + f.text + " " + (data.sets[f.set] || "")).toLowerCase().includes(s)));
  };

  function renderFilters() {
    q(".kpg-tabs").innerHTML = [["all", "All"], ...data.tabs.map(t => [t.id, t.name])].map(([id, name]) => {
      const n = id === "all" ? data.frames.length : data.frames.filter(f => f.tab === id).length;
      return `<button type="button" role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${esc(name)} <span class="kps-n">${n}</span></button>`;
    }).join("");
    const sets = st.tab === "all" ? data.tabs.flatMap(t => t.sets.map(s => [s, t.name + " · " + data.sets[s]])) : data.tabs.find(t => t.id === st.tab).sets.map(s => [s, data.sets[s]]);
    if (st.set !== "all" && !sets.some(([s]) => s === st.set)) st.set = "all";
    q('[data-f="set"]').innerHTML = `<option value="all">All sets</option>` + sets.map(([s, n]) => `<option value="${s}"${s === st.set ? " selected" : ""}>${esc(n)}</option>`).join("");
    q(".kpg-star-only").setAttribute("aria-pressed", String(st.starred));
  }

  function card(f) {
    const tg = tagCache.get(f.id);
    const chips = [...tg.camera.slice(0, 2), ...tg.light.slice(0, 1)];
    return `<button type="button" class="kpg-card${f.id === st.focus ? " is-focus" : ""}${cur && f.id === cur.id ? " is-current" : ""}" data-id="${esc(f.id)}" aria-label="${esc(frameNo(f.id) + " " + f.title)}">
      ${thumbHTML(f, thumbs)}
      <span class="kpg-meta">
        <span class="kpg-title">${thumbs[f.id] ? `<span class="kps-no">${frameNo(f.id)}</span> ` : ""}${esc(f.title)}${favs.has(f.id) ? ' <span class="kpg-fav">★</span>' : ""}${edited[f.id] ? ' <span class="kps-badge kps-upd">Edited</span>' : ""}</span>
        <span class="kpg-set">${esc(TABNAME[f.tab])} · ${esc(data.sets[f.set])}</span>
        ${thumbs[f.id] ? "" : `<span class="kpg-snip">${esc(snippet(f))}</span>`}
        ${chips.length ? `<span class="kpg-chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</span>` : ""}
      </span>
    </button>`;
  }

  function renderGrid() {
    edited = loadEdits();
    const list = visible();
    q(".kpg-count").textContent = `${list.length} frame${list.length === 1 ? "" : "s"}`;
    q(".kpg-grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="kps-empty">${st.starred && !favs.size ? "Nothing starred yet. Star a frame in the detail panel to keep it here." : "No frames match. Clear the search or a filter."}</div>`;
    if (!st.focus || !list.some(f => f.id === st.focus)) st.focus = list[0] ? list[0].id : null;
    renderDetail();
  }

  function renderDetail() {
    const box = q(".kpg-detail");
    const f = data.frames.find(x => x.id === st.focus);
    el.querySelectorAll(".kpg-card").forEach(c => c.classList.toggle("is-focus", c.dataset.id === st.focus));
    if (!f) { box.innerHTML = ""; return; }
    const tg = tagCache.get(f.id);
    const text = promptFor(f, settings());
    box.innerHTML = `
      ${thumbHTML(f, thumbs, "kpg-big")}
      <div class="kpg-dhead"><span class="kps-no">${frameNo(f.id)}</span><h3>${esc(f.title)}</h3></div>
      <p class="kpg-set">${esc(TABNAME[f.tab])} · ${esc(data.sets[f.set])} · ${text.split(/\s+/).length} words</p>
      ${[...tg.camera, ...tg.light].length ? `<p class="kpg-chips">${[...tg.camera, ...tg.light].map(c => `<span>${esc(c)}</span>`).join("")}</p>` : ""}
      <pre class="kps-prompt">${esc(text)}</pre>
      ${f.note ? `<p class="kps-note"><b>Why it works:</b> ${esc(f.note)}</p>` : ""}
      <div class="kps-actions">
        ${picking ? `<button type="button" class="kps-btn kpg-primary" data-use="${esc(f.id)}">Use this frame</button>` : ""}
        <button type="button" class="kps-btn" data-copy="${esc(f.id)}">Copy prompt</button>
        <button type="button" class="kps-btn" data-edit="${esc(f.id)}">${edited[f.id] ? "Edit your version" : "Edit prompt"}</button>
        ${actions.map((a, i) => `<button type="button" class="kps-btn kps-accent" data-act="${i}">${esc(a.label)}</button>`).join("")}
        <button type="button" class="kps-star" data-star="${esc(f.id)}" aria-pressed="${favs.has(f.id)}" aria-label="Star">${favs.has(f.id) ? "★" : "☆"}</button>
      </div>
      ${setPreview ? `<p class="kpg-prev kps-muted"><button type="button" class="kps-btn" data-setprev="${esc(f.id)}">${thumbs[f.id] ? "Replace preview with last render" : "Use last render as preview"}</button> Shows your latest ComfyUI image on this card.</p>` : ""}
      <p class="kps-muted">${picking ? "Click a card to use it. " : ""}Trigger, Style and Person come from the Pose Sheet sidebar.</p>`;
  }

  function pick(id) {
    const f = data.frames.find(x => x.id === id);
    if (!f) return;
    onPick(f);
    close();
  }
  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (open && open.el === el) open = null;
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  }
  function moveFocus(delta) {
    const cards = [...el.querySelectorAll(".kpg-card")];
    if (!cards.length) return;
    let i = cards.findIndex(c => c.dataset.id === st.focus);
    const cols = Math.max(1, Math.round(q(".kpg-grid").clientWidth / cards[0].offsetWidth));
    i = Math.min(cards.length - 1, Math.max(0, i + (delta === "row" ? cols : delta === "-row" ? -cols : delta)));
    st.focus = cards[i].dataset.id; renderDetail();
    cards[i].focus(); cards[i].scrollIntoView({ block: "nearest" });
  }
  function onKey(e) {
    if (document.querySelector(".kpe")) return;
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.target === search) return;
    const map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: "row", ArrowUp: "-row" };
    if (map[e.key] !== undefined && e.target.closest(".kpg-grid")) { e.preventDefault(); moveFocus(map[e.key]); }
  }

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el || t.closest(".kpg-close")) { close(); return; }
    const tb = t.closest(".kpg-tabs button");
    if (tb) { st.tab = tb.dataset.tab; store.set("g:tab", st.tab); st.set = "all"; renderFilters(); renderGrid(); return; }
    if (t.closest(".kpg-star-only")) { st.starred = !st.starred; renderFilters(); renderGrid(); return; }
    const cd = t.closest(".kpg-card");
    if (cd) { if (picking) { pick(cd.dataset.id); return; } st.focus = cd.dataset.id; renderDetail(); return; }
    const use = t.closest("[data-use]");
    if (use) { pick(use.dataset.use); return; }
    const cp = t.closest("[data-copy]");
    if (cp) {
      const f = data.frames.find(x => x.id === cp.dataset.copy);
      navigator.clipboard.writeText(promptFor(f, settings())).then(() => { cp.textContent = "Copied"; setTimeout(() => { cp.textContent = "Copy prompt"; }, 1400); }, () => { cp.textContent = "Copy failed"; });
      return;
    }
    const ac = t.closest("[data-act]");
    if (ac) { const f = data.frames.find(x => x.id === st.focus); actions[+ac.dataset.act].run(f, promptFor(f, settings()), ac); return; }
    const ed = t.closest("[data-edit]");
    if (ed) {
      const f = data.frames.find(x => x.id === ed.dataset.edit);
      editPrompt({ frame: f, initial: loadEdits()[f.id], onSave: txt => { saveEdit(f.id, txt); renderGrid(); } });
      return;
    }
    const sp = t.closest("[data-setprev]");
    if (sp) {
      sp.disabled = true; sp.textContent = "Saving…";
      setPreview(sp.dataset.setprev).then(url => { thumbs[sp.dataset.setprev] = url; renderGrid(); },
        err => { sp.disabled = false; sp.textContent = err && err.message ? err.message : "Couldn't save preview"; });
      return;
    }
    const sr = t.closest("[data-star]");
    if (sr) {
      const id = sr.dataset.star;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      store.set("favs", JSON.stringify([...favs]));
      renderGrid();
    }
  });
  el.addEventListener("mouseover", e => {
    const cd = e.target.closest(".kpg-card");
    if (cd && cd.dataset.id !== st.focus) { st.focus = cd.dataset.id; renderDetail(); }
  });
  el.addEventListener("focusin", e => {
    const cd = e.target.closest(".kpg-card");
    if (cd && cd.dataset.id !== st.focus) { st.focus = cd.dataset.id; renderDetail(); }
  });
  el.addEventListener("keydown", e => {
    const cd = e.target.closest(".kpg-card");
    if (cd && e.key === "Enter" && picking) { e.preventDefault(); pick(cd.dataset.id); }
  });
  el.addEventListener("change", e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (f) { st[f] = e.target.value; renderGrid(); }
  });
  search.addEventListener("input", () => { st.q = search.value; renderGrid(); });
  const returnFocus = document.activeElement;
  document.addEventListener("keydown", onKey, true);

  renderFilters(); renderGrid();
  search.focus({ preventScroll: true });
  if (cur) { const c = el.querySelector(`.kpg-card[data-id="${CSS.escape(cur.id)}"]`); if (c) c.scrollIntoView({ block: "center" }); }
  open = { el, close };
  return open;
}

// A small dialog to rewrite a frame's prompt. onSave(text) gets "" when reset to the sheet's wording.
export function editPrompt({ frame, initial, onSave }) {
  const el = document.createElement("div");
  el.className = "kps kpg kpe";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Edit prompt");
  el.innerHTML = `<div class="kpe-box">
    <div class="kpg-dhead"><span class="kps-no">${frameNo(frame.id)}</span><h3>Edit ${esc(frame.title)}</h3></div>
    <p class="kps-muted">Your version is saved for you only and used everywhere you pick this frame. Keep <b>[trigger]</b> where your LoRA trigger or person should go.</p>
    <textarea class="kpe-text" spellcheck="true" rows="12"></textarea>
    <div class="kps-row"><span class="kpe-words kps-muted"></span><span class="kps-grow"></span>
      <button type="button" class="kps-btn" data-x="reset">Reset to sheet text</button>
      <button type="button" class="kps-btn" data-x="cancel">Cancel</button>
      <button type="button" class="kps-btn kpg-primary" data-x="save">Save</button></div>
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
