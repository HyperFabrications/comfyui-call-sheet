// Build an outfit: pick a top, bottoms or a one piece, outerwear, shoes and accessories, each in a color, or your own items.
// openOutfitBuilder({ data, outfits, state, sample, onChange(state) }). Changes apply as you make them.
import { parts, outfitText, withOutfit, locked, garmentOf, WEARING } from "./outfit_core.js";
import { split } from "./scene_core.js";
import { outfitSVG, lookOf } from "./outfit_art.js";
import { frameNo } from "./core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;
const COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const LOCK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const WARN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>`;
const PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const UP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>`;
const DOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>`;

// ---- your own items (custom_outfit_items.json on your computer) ----
const API = "/krea_pose_sheet/outfit_items";
export async function loadItems() {
  try { const r = await fetch(API, { cache: "no-store" }); if (!r.ok) return null; return (await r.json()).items || []; } catch (e) { return null; }
}
export async function saveItem(p) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save the item");
  return j.item;
}
export async function deleteItem(id) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete the item");
}
async function importItems(file) {
  let body;
  try { body = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a clothing export."); }
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

// ---- saved outfits (in this browser) ----
const SKEY = "kps:outfits";
const loadSaved = () => { try { const a = JSON.parse(localStorage.getItem(SKEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const storeSaved = a => { try { localStorage.setItem(SKEY, JSON.stringify(a)); } catch (e) {} };

// Ideas for the guided item writer.
const IDEAS = [
  { name: "Vintage band tee", cat: "top", fit: "faded", color: "black", fabric: "cotton", item: "vintage band tee", detail: "a cracked print" },
  { name: "Silk slip dress", cat: "one", fit: "bias cut", color: "champagne", fabric: "silk", item: "slip dress", detail: "lace trim" },
  { name: "Biker jacket", cat: "outer", fit: "cropped", color: "oxblood", fabric: "leather", item: "biker jacket", detail: "silver zips" },
  { name: "Chunky loafers", cat: "shoes", fit: "chunky", color: "black", fabric: "patent leather", item: "loafers", detail: "gold buckles" },
  { name: "Pleated tennis skirt", cat: "bottom", fit: "pleated", color: "white", fabric: "cotton", item: "tennis skirt", detail: "a navy stripe at the hem" },
];
const TIPS = [
  "Describe the piece, not how she wears it. The pose brings the action.",
  "Lead with cut, color and fabric, then the piece: a cropped oxblood leather biker jacket.",
  "One clear detail reads better than three.",
  "Pick the right kind of piece, so Just what I pick swaps the right thing.",
];
const EXTRA_HEX = { champagne: "#e6d2b0", oxblood: "#5a1f24", burgundy: "#6b1f2e", ivory: "#f1ead8", beige: "#d8c3a0", tan: "#b98d5f", khaki: "#b3a27a", green: "#3f6b4a", blue: "#3d63a8", yellow: "#e6c65a", orange: "#d9783a", purple: "#6a4a8c", lilac: "#b9a2d4", silver: "#b8bcc4", gold: "#d9b45a", denim: "#4a6a94" };
const CATS = ["top", "bottom", "one", "outer", "shoes", "acc"];
const an = s => s.replace(/^a (?=[aeiou])/i, "an ");

let current = null;

export function openOutfitBuilder({ data, outfits, state = {}, sample = null, onChange = () => {}, doneLabel = "Done" }) {
  if (current) current.close();
  const C = outfits.categories;
  const CATN = Object.fromEntries(C.map(c => [c.key, c.label]));
  const st = { cat: C[0].key, mode: "build", s: { on: true, swap: "whole", acc: [], ...state }, mine: [], hasServer: false, ex: 0, edit: null, help: false, naming: false };
  if (!Array.isArray(st.s.acc)) st.s.acc = [];
  const samples = [sample, ...["S33", "S1", "S25", "S38"].map(id => data.frames.find(f => f.id === id))].filter((f, i, a) => f && a.findIndex(x => x && x.id === f.id) === i);
  const P = () => parts(outfits, st.s, st.mine);
  const optOf = (k, v) => { const c = C.find(x => x.key === k); return c && v ? c.options.find(o => o.value === v) || null : null; };
  const mineOf = v => st.mine.find(m => m.id === v) || null;
  const nameOf = (k, v) => (mineOf(v) || optOf(k, v) || {}).name || "";
  const colorOf = v => outfits.colors.find(c => c.value === v) || null;

  const el = document.createElement("div");
  el.className = "kq kq-builder kqs kqo";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Build an outfit");
  el.innerHTML = `<div class="kq-box">
    <header class="kq-head">
      <button type="button" class="kq-icon" data-x="close" aria-label="Back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h2>Outfit</h2>
      <span class="kq-dim">Changes what she wears in any frame whose pose doesn't rely on a garment</span>
      <span class="kq-grow"></span>
      <button type="button" class="kq-ghost" data-x="reset">Reset</button>
      <button type="button" class="kq-primary kq-sm" data-x="done">${esc(doneLabel)}</button>
    </header>
    <div class="kqb-body">
      <div class="kqb-left">
        <nav class="kqb-nav" aria-label="Pieces"></nav>
        <section class="kqb-presets" aria-label="Saved outfits"></section>
      </div>
      <section class="kqb-opts kqs-mid"></section>
      <aside class="kqb-side">
        <div class="kqb-stage kqs-stage"><div class="kqs-art-box"></div><span class="kqs-badge"></span><div class="kqb-chips"></div></div>
        <div class="kqb-send">
          <div class="kq-row"><span class="kq-strong">Use this outfit</span><span class="kq-dim kqo-where"></span><span class="kq-grow"></span>
            <button type="button" class="kq-switch" data-x="on" aria-label="Use this outfit in prompts"><span></span></button></div>
          <div class="kq-row"><span>Swap</span><span class="kq-grow"></span>
            <div class="kqo-seg" role="group" aria-label="What to swap">
              <button type="button" data-swap="whole" title="Replace everything she wears in the frame">Whole outfit</button>
              <button type="button" data-swap="pick" title="Swap only the pieces you picked and keep the rest of the frame's clothes">Just what I pick</button></div></div>
          <p class="kqo-warn" hidden></p>
          <p class="kq-mono kqb-desc kqs-desc"></p>
          <button type="button" class="kq-ghost kq-tight" data-x="copy">${COPY}<span>Copy</span></button>
        </div>
      </aside>
    </div>
    <input type="file" class="kqs-file" accept=".json,application/json" hidden>
  </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const emit = () => onChange({ ...st.s, acc: st.s.acc.slice() });
  const any = () => !!(st.s.top || st.s.bottom || st.s.one || st.s.outer || st.s.shoes || st.s.acc.length);

  function pick(cat, v) {
    const s = { ...st.s, acc: st.s.acc.slice() };
    if (cat === "acc") {
      s.acc = !v ? [] : s.acc.includes(v) ? s.acc.filter(x => x !== v) : [...s.acc, v];
    } else {
      s[cat] = v; delete s[cat + "C"];
      if (!v) delete s[cat];
      if (cat === "one" && v) { delete s.top; delete s.topC; delete s.bottom; delete s.bottomC; }
      if ((cat === "top" || cat === "bottom") && v) { delete s.one; delete s.oneC; }
    }
    if (v) s.on = true;
    st.s = s; emit(); renderNav(); renderMid(); renderSide();
  }

  // ----- left -----
  function valueOf(k) {
    if (k === "acc") return st.s.acc.length === 1 ? nameOf("acc", st.s.acc[0]) || "1 picked" : st.s.acc.length ? `${st.s.acc.length} picked` : "";
    if ((k === "top" || k === "bottom") && st.s.one) return "One piece";
    return nameOf(k, st.s[k]);
  }
  function renderNav() {
    q(".kqb-nav").innerHTML = C.map(c => {
      const v = valueOf(c.key), cur = st.mode === "build" && c.key === st.cat;
      return `<button type="button" data-cat="${c.key}" aria-current="${cur}"><span>${esc(c.label)}</span><span class="${!v || v === "One piece" ? "kq-faint" : ""}">${esc(v || "None")}</span></button>`;
    }).join("");
  }
  const genericName = list => { let n = list.length + 1; while (list.some(p => p.name === `Outfit ${n}`)) n++; return `Outfit ${n}`; };
  const dot = s => {
    const top = s.one ? lookOf(outfits, "one", s.one, s.oneC, st.mine) : lookOf(outfits, "top", s.top, s.topC, st.mine);
    const bot = s.one ? top : lookOf(outfits, "bottom", s.bottom, s.bottomC, st.mine);
    const a = top ? top.hex : "#5c5c66", b = bot ? bot.hex : "#5c5c66";
    return `<span class="kqo-dot" style="background:linear-gradient(180deg,${a} 50%,${b} 50%)"></span>`;
  };
  function renderSaved() {
    const list = loadSaved(), box = q(".kqb-presets");
    box.innerHTML = `<div class="kqb-ph kq-row"><span class="kq-grow">Saved outfits</span>
        <button type="button" class="kq-ghost kq-tight kqs-mini" data-x="simport" title="Add outfits from a file. Nothing you have is replaced.">Import</button>
        <button type="button" class="kq-ghost kq-tight kqs-mini" data-x="sexport" title="Save your outfits as a file">Export</button></div>
      ${list.length ? list.map((p, i) => `<div class="kqb-preset">${dot(p.state || {})}<button type="button" data-preset="${i}" title="Load ${esc(p.name)}">${esc(p.name)}</button><button type="button" class="kqb-pdel" data-pdel="${i}" aria-label="Delete ${esc(p.name)}">×</button></div>`).join("") : `<p class="kq-faint kqb-pnone">Save an outfit to reuse it later.</p>`}
      ${st.naming ? `<label class="kqb-pname"><input type="text" maxlength="40" placeholder="${esc(genericName(list))}" aria-label="Outfit name"><button type="button" class="kq-ghost kq-tight kq-filled" data-x="ssave">Save</button></label>`
        : `<button type="button" class="kq-ghost kq-tight kqb-padd" data-x="snew"${any() ? "" : " disabled"}>+ Save this outfit</button>`}`;
    if (st.naming) {
      const inp = box.querySelector("input");
      inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commitSaved(inp.value); } if (e.key === "Escape") { e.preventDefault(); st.naming = false; renderSaved(); } });
      inp.focus();
    }
  }
  // Your own items used in the outfit travel with it, so a saved or shared outfit still works.
  const usedItems = s => [s.top, s.bottom, s.one, s.outer, s.shoes, ...(s.acc || [])].map(mineOf).filter(Boolean).map(({ id, cat, name, text, hex }) => ({ id, cat, name, text, hex }));
  function commitSaved(name) {
    const list = loadSaved();
    const s = { ...st.s, acc: st.s.acc.slice() }; delete s.on;
    list.push({ name: (name || "").trim() || genericName(list), state: s, items: usedItems(s) });
    storeSaved(list); st.naming = false; renderSaved();
  }
  async function loadPreset(p) {
    const s = { ...p.state, acc: Array.isArray(p.state.acc) ? p.state.acc.slice() : [], on: true };
    const remap = {};
    for (const it of Array.isArray(p.items) ? p.items : []) {
      const hit = st.mine.find(m => m.text === it.text && m.cat === it.cat);
      if (hit) remap[it.id] = hit.id;
      else if (st.hasServer) { try { const n = await saveItem(it); st.mine.push(n); remap[it.id] = n.id; } catch (e) {} }
    }
    for (const k of ["top", "bottom", "one", "outer", "shoes"]) if (remap[s[k]]) s[k] = remap[s[k]];
    s.acc = s.acc.map(a => remap[a] || a);
    st.s = s; emit(); renderAll();
  }

  // ----- middle -----
  function tabs() {
    return `<div class="kqs-tabs" role="tablist" aria-label="Mode">
      <button type="button" role="tab" data-mode="build" aria-selected="${st.mode === "build"}">Build</button>
      <button type="button" role="tab" data-mode="items" aria-selected="${st.mode !== "build"}">Your items <span class="kq-faint">${st.mine.length}</span></button></div>`;
  }
  function example() {
    if (!samples.length) return "";
    const f = samples[st.ex % samples.length], p = P();
    const lock = locked(outfits, f, []);
    const [txt, changed] = withOutfit(outfits, f, p, []);
    let body = esc(txt);
    if (changed) { const line = split(txt).find((x, j) => j >= 1 && WEARING.test(x)); if (line) body = body.replace(esc(line), `<mark>${esc(line)}</mark>`); }
    const note = !st.s.on ? `<span class="kq-dim">Outfit off. Frames keep their own clothes.</span>`
      : lock ? `<span class="kqs-lock">${LOCK}<span>Keeps its own clothes: the pose uses ${esc(garmentOf(outfits, f))}. You can override it per frame in the picker.</span></span>` : "";
    return `<div class="kqs-ex">
      <div class="kq-row"><span class="kq-strong">On a frame</span><span class="kq-dim">${frameNo(f.id)} · ${esc(f.title)}</span><span class="kq-grow"></span>
        ${samples.length > 1 ? `<button type="button" class="kq-ghost kq-tight" data-x="nextex">Try another frame</button>` : ""}</div>
      ${note}
      <p class="kqs-extext">${body.replace("[trigger]", '<span class="kq-faint">[trigger]</span>')}</p></div>`;
  }
  const swatch = (cat, v, color) => { const l = lookOf(outfits, cat, v, color, st.mine); return l ? l.hex : "transparent"; };
  function renderMid() {
    const box = q(".kqs-mid");
    if (st.mode === "edit") { renderEditor(box); return; }
    if (st.mode === "items") {
      box.innerHTML = `${tabs()}
        <div class="kq-row kqs-ph"><span class="kq-dim kq-grow">Pieces you write yourself. They show up in their category in Build.</span>
          ${st.hasServer ? `<button type="button" class="kq-ghost kq-tight" data-x="iimport" title="Add items from a file. Nothing you have is replaced.">${UP}<span>Import</span></button>
          <button type="button" class="kq-ghost kq-tight" data-x="iexport" title="Save your items as a file">${DOWN}<span>Export</span></button>` : ""}</div>
        <div class="kqs-places">
          ${st.hasServer ? `<button type="button" class="kqs-place kqs-new" data-x="newitem">${PLUS}<span><span class="kq-strong">New item</span><span class="kq-dim">Write your own, with help</span></span></button>` : `<p class="kq-dim">Your own items need the Call Sheet nodes running in ComfyUI.</p>`}
          ${st.mine.map(m => `<div class="kqs-place" role="button" tabindex="0" data-item="${esc(m.id)}" title="${esc(m.text)}">
            <span class="kqs-sw kqo-isw" style="background:${esc(m.hex || "#8a8a92")}"></span>
            <span class="kqs-pt"><span class="kqs-pname">${esc(m.name)} <span class="kqs-yours">${esc(CATN[m.cat] || "")}</span></span><span class="kq-dim">${esc(m.text)}</span></span>
            <span class="kqs-pact"><button type="button" class="kq-ghost kq-tight" data-iedit="${esc(m.id)}">Edit</button><button type="button" class="kqb-pdel kqs-pdel" data-idel="${esc(m.id)}" aria-label="Delete ${esc(m.name)}">×</button></span>
          </div>`).join("")}
        </div>
        ${example()}`;
      return;
    }
    const i = C.findIndex(c => c.key === st.cat), c = C[i], k = c.key;
    const mine = st.mine.filter(m => m.cat === k);
    const list = [{ value: "", name: "None" }, ...c.options, ...mine.map(m => ({ value: m.id, name: m.name, mine: true }))];
    const isOn = v => k === "acc" ? (v ? st.s.acc.includes(v) : !st.s.acc.length) : (st.s[k] || "") === v;
    const cur = k !== "acc" ? optOf(k, st.s[k]) : null;
    const curC = cur ? st.s[k + "C"] || cur.color : "";
    const hint = (k === "top" || k === "bottom") && st.s.one ? "Picking one clears the one piece" : c.hint || "";
    const note = k === "acc" ? "" : mineOf(st.s[k]) ? "Your item uses its own wording, color and all." : !st.s[k] ? "Pick a piece, then a color." : "";
    box.innerHTML = `${tabs()}
      <div class="kqb-title"><h3>${esc(c.label)}</h3><span class="kq-dim">${esc(hint)}</span></div>
      <div class="kqb-grid">${list.map(o => {
        const on = isOn(o.value);
        const sw = !o.value ? "transparent" : swatch(k, o.value, on && k !== "acc" ? st.s[k + "C"] : "");
        return `<button type="button" class="kqb-opt" data-val="${esc(o.value)}" aria-pressed="${on}"><span class="kqb-sw" style="background:${sw}"></span><span class="kq-grow">${esc(o.name)}${o.mine ? ' <span class="kqs-yours">Yours</span>' : ""}</span>${on ? CHECK : ""}</button>`;
      }).join("")}</div>
      ${cur && cur.color ? `<div class="kqo-colors"><div class="kq-row"><span class="kq-strong">Color</span><span class="kq-dim">${esc((colorOf(curC) || {}).word || "")}</span></div>
        <div class="kqo-sws" role="group" aria-label="Color">${outfits.colors.map(x => `<button type="button" class="kqo-csw" data-color="${esc(x.value)}" aria-pressed="${curC === x.value}" title="${esc(x.word)}" aria-label="${esc(x.word)}" style="background:${x.hex}"></button>`).join("")}</div></div>`
        : note ? `<p class="kq-dim kqo-cnote">${esc(note)}</p>` : ""}
      ${example()}
      <div class="kqb-steps">
        <button type="button" class="kq-ghost" data-step="-1">← ${esc(C[(i - 1 + C.length) % C.length].label)}</button>
        <span class="kq-dim kqb-prog">${i + 1} of ${C.length}</span>
        <button type="button" class="kq-ghost kq-filled" data-step="1">${esc(C[(i + 1) % C.length].label)} →</button>
      </div>`;
  }

  // ----- the item editor, with the guided helper -----
  function composeDraft(e) {
    const g = e.guide, item = (g.item || "").trim();
    const words = [g.fit, g.color, g.fabric, g.item].map(x => (x || "").trim()).filter(Boolean).join(" ");
    if (!words) return e.text;
    const plural = e.cat === "shoes" || (/s$/.test(item) && !/(dress|ss)$/.test(item));
    return (plural ? words : an("a " + words)) + (g.detail && g.detail.trim() ? " with " + g.detail.trim() : "");
  }
  function hexOf(e) {
    const words = (e.guide.color + " " + e.text).toLowerCase();
    const c = outfits.colors.find(x => new RegExp(`\\b${x.word}\\b`).test(words));
    if (c) return c.hex;
    const k = Object.keys(EXTRA_HEX).find(w => new RegExp(`\\b${w}\\b`).test(words));
    return k ? EXTRA_HEX[k] : "#8a8a92";
  }
  // Colors offered for your own items: the builder's set plus a few more, each with the word it puts in the wording.
  const EDIT_COLORS = [...outfits.colors.map(c => ({ word: c.word, hex: c.hex })),
    ...["burgundy", "ivory", "beige", "green", "blue", "lilac", "purple", "yellow", "orange", "gold", "silver"].map(w => ({ word: w, hex: EXTRA_HEX[w] }))];
  const COLOR_WORDS = [...new Set([...EDIT_COLORS.map(c => c.word), ...outfits.colors.map(c => c.value), ...Object.keys(EXTRA_HEX)])].sort((a, b) => b.length - a.length);
  const hexNow = e => e.hexSet && e.hex ? e.hex : hexOf(e);
  // Swap the first color word in the wording for the new one, so the prompt says the color you picked.
  function recolor(text, word) {
    for (const w of COLOR_WORDS) {
      const re = new RegExp(`\\b${w}\\b`, "i");
      if (re.test(text)) return text.replace(re, word);
    }
    return null;
  }
  function renderEditor(box) {
    const e = st.edit, g = e.guide, cur = hexNow(e).toLowerCase();
    box.innerHTML = `${tabs()}
      <div class="kqb-title"><h3>${e.id ? "Edit item" : "New item"}</h3><span class="kq-dim">Saved on this computer, like your custom prompts</span></div>
      <label class="kqs-field"><span class="kq-strong">Name</span><input type="text" data-e="name" maxlength="60" placeholder="Biker jacket" value="${esc(e.name)}"></label>
      <div class="kqs-field"><span class="kq-strong">Kind of piece</span><div class="kqo-cats" role="group" aria-label="Kind of piece">${CATS.map(k => `<button type="button" class="kq-chip" data-ecat="${k}" aria-pressed="${e.cat === k}">${esc(CATN[k] || k)}</button>`).join("")}</div></div>
      <label class="kqs-field"><span class="kq-row"><span class="kq-strong">Wording</span><span class="kq-dim">How it reads in the prompt</span></span>
        <textarea data-e="text" rows="2" placeholder="a cropped oxblood leather biker jacket with silver zips">${esc(e.text)}</textarea></label>
      <div class="kqs-field kqo-colors kqo-ecolors"><div class="kq-row"><span class="kq-strong">Color</span><span class="kq-dim">${e.hexSet ? "Picked by you" : "Follows the wording"}</span></div>
        <div class="kqo-sws" role="group" aria-label="Item color">
          <button type="button" class="kq-chip kqo-auto" data-ehex="auto" aria-pressed="${!e.hexSet}" title="Use the color named in the wording">Auto</button>
          ${EDIT_COLORS.map(c => `<button type="button" class="kqo-csw" data-ehex="${c.hex}" data-eword="${esc(c.word)}" aria-pressed="${!!e.hexSet && cur === c.hex.toLowerCase()}" title="${esc(c.word)}" aria-label="${esc(c.word)}" style="background:${c.hex}"></button>`).join("")}
          <label class="kqo-custom" title="Any color"><input type="color" data-ehexin value="${esc(cur)}" aria-label="Pick any color"><span class="kq-dim">Any color</span></label>
        </div>
        <p class="kq-dim kqo-chint">A named color also changes the word in the wording. Any color only changes the figure, so name the color in the wording too.</p>
      </div>
      <button type="button" class="kq-ghost kq-tight kqs-helpbtn" data-x="help" aria-expanded="${st.help}">${st.help ? "Hide help" : "Help me write it"}</button>
      ${st.help ? `<div class="kqs-help">
        <p class="kq-dim">Fill in what you know. The wording writes itself as you type.</p>
        <div class="kqs-ideas"><span class="kq-dim">Start from an idea:</span>${IDEAS.map((x, i) => `<button type="button" class="kq-chip" data-idea="${i}">${esc(x.name)}</button>`).join("")}</div>
        <div class="kqo-guide">
          ${[["fit", "Cut or feel", "cropped"], ["color", "Color", "oxblood"], ["fabric", "Fabric", "leather"], ["item", "The piece", "biker jacket"], ["detail", "One detail", "silver zips"]].map(([k, l, ph]) =>
            `<label class="kqs-field"><span>${l}</span><input type="text" data-g="${k}" placeholder="${ph}" value="${esc(g[k])}"></label>`).join("")}
        </div>
        <ul class="kqs-tips">${TIPS.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>` : ""}
      <div class="kq-row kqs-efoot"><span class="kq-dim kqs-emsg"></span><span class="kq-grow"></span>
        <button type="button" class="kq-ghost" data-x="ecancel">Cancel</button>
        <button type="button" class="kq-primary kq-sm" data-x="esave">${e.id ? "Save item" : "Save and wear"}</button></div>`;
    box.querySelectorAll("input, textarea").forEach(inp => {
      inp.addEventListener("keydown", ev => ev.stopPropagation());
      if (inp.dataset.ehexin !== undefined) {
        inp.addEventListener("input", () => { e.hex = inp.value; e.hexSet = true; renderSide(); });
        inp.addEventListener("change", () => renderMid());
        return;
      }
      inp.addEventListener("input", () => {
        if (inp.dataset.e) e[inp.dataset.e] = inp.value;
        if (inp.dataset.g) { g[inp.dataset.g] = inp.value; e.text = composeDraft(e); const t = box.querySelector('[data-e="text"]'); if (t) t.value = e.text; }
        renderSide();
      });
    });
  }
  function startEdit(m) {
    st.edit = { id: m ? m.id : "", name: m ? m.name : "", cat: m ? m.cat : (st.cat in CATN ? st.cat : "top"), text: m ? m.text : "", hex: m ? m.hex : "",
      hexSet: !!(m && m.hex && m.hex.toLowerCase() !== hexOf({ guide: { color: "" }, text: m.text }).toLowerCase()), guide: { fit: "", color: "", fabric: "", item: "", detail: "" } };
    st.help = !m; st.mode = "edit"; renderNav(); renderMid(); renderSide();
    q('[data-e="name"]')?.focus();
  }

  // ----- right -----
  function renderSide() {
    const p = P(), ed = st.mode === "edit" ? st.edit : null;
    let shown = st.s, items = st.mine;
    if (ed && ed.text.trim()) {
      // Preview the item you're writing on the figure, in place of that piece.
      const tmp = { id: "__draft", cat: ed.cat, text: ed.text, hex: hexNow(ed) };
      items = [...st.mine, tmp];
      shown = { ...st.s, acc: st.s.acc.slice() };
      if (ed.cat === "acc") shown.acc = [...shown.acc, "__draft"]; else { shown[ed.cat] = "__draft"; if (ed.cat === "one") { delete shown.top; delete shown.bottom; } if (ed.cat === "top" || ed.cat === "bottom") delete shown.one; }
    }
    const own = outfitText(p);
    q(".kqs-art-box").innerHTML = outfitSVG(outfits, shown, items, { on: st.s.on !== false, aria: own ? "Figure " + own.charAt(0).toLowerCase() + own.slice(1) : "Figure with nothing picked" });
    q(".kqs-badge").textContent = ed ? (ed.name || "New item") : st.s.on === false ? "Off · frames keep their own clothes" : st.s.swap === "pick" ? "Just what I pick" : "Whole outfit";
    const chips = [];
    if (!ed) for (const c of C) {
      if (c.key === "acc") { for (const a of st.s.acc) chips.push([nameOf("acc", a), "acc", a]); continue; }
      if (st.s[c.key]) chips.push([nameOf(c.key, st.s[c.key]), c.key, ""]);
    }
    q(".kqb-chips").innerHTML = chips.map(([t, k, v]) => `<button type="button" class="kq-chip" data-clear="${k}" data-cv="${esc(v)}" aria-label="Remove ${esc(t)}">${esc(t)}<span aria-hidden="true">×</span></button>`).join("");
    q('[data-x="on"]').setAttribute("aria-pressed", String(st.s.on !== false));
    q(".kqo-where").textContent = st.s.on === false ? "off, frames keep their own clothes" : "on frames that can change clothes";
    el.querySelectorAll("[data-swap]").forEach(b => b.setAttribute("aria-pressed", String((st.s.swap === "pick" ? "pick" : "whole") === b.dataset.swap)));
    const w = q(".kqo-warn");
    const warn = st.s.on !== false && any() && st.s.swap !== "pick" && !p.dressed;
    w.hidden = !warn;
    w.innerHTML = warn ? `${WARN}<span>Whole outfit replaces everything she wears in the frame. Add a top and bottoms or a one piece, or switch to Just what I pick.</span>` : "";
    const d = q(".kqs-desc");
    const txt = ed ? ed.text : own;
    d.classList.toggle("is-off", st.s.on === false);
    d.innerHTML = st.s.on === false && !ed ? `<span class="kq-faint">Off. Frames keep their own clothes.</span>` : txt ? esc(txt) : `<span class="kq-faint">Pick a top and bottoms, or a one piece, to start.</span>`;
  }
  const renderAll = () => { renderNav(); renderSaved(); renderMid(); renderSide(); };

  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (current && current.el === el) current = null;
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (st.mode === "edit") { st.mode = "items"; renderMid(); renderSide(); } else close(); }
  }
  function flash(btn, text, ms = 1600) {
    const s = btn.querySelector("span") || btn, old = s.textContent;
    s.textContent = text; setTimeout(() => { if (s.isConnected) s.textContent = old; }, ms);
  }
  const arm = (b, done) => {
    if (!b.classList.contains("is-armed")) { b.classList.add("is-armed"); b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { b.classList.remove("is-armed"); b.textContent = "×"; } }, 3000); return; }
    done();
  };
  let fileFor = "";

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el) { close(); return; }
    const md = t.closest("[data-mode]");
    if (md) { st.mode = md.dataset.mode; renderNav(); renderMid(); renderSide(); return; }
    const sw = t.closest("[data-swap]");
    if (sw) { st.s = { ...st.s, swap: sw.dataset.swap, on: true }; emit(); renderSide(); renderMid(); return; }
    const col = t.closest("[data-color]");
    if (col) { st.s = { ...st.s, [st.cat + "C"]: col.dataset.color, on: true }; emit(); renderMid(); renderSide(); return; }
    const ec = t.closest("[data-ecat]");
    if (ec) { st.edit.cat = ec.dataset.ecat; if (st.help) st.edit.text = composeDraft(st.edit); renderMid(); renderSide(); return; }
    const eh = t.closest("[data-ehex]");
    if (eh) {
      const ed = st.edit;
      if (eh.dataset.ehex === "auto") { ed.hexSet = false; ed.hex = ""; }
      else {
        ed.hex = eh.dataset.ehex; ed.hexSet = true;
        const word = eh.dataset.eword;
        const g = ed.guide;
        if (st.help && (g.fit || g.fabric || g.item).trim()) { g.color = word; ed.text = composeDraft(ed); }
        else { const t2 = recolor(ed.text, word); if (t2 !== null) ed.text = t2; if (st.help) g.color = word; }
      }
      renderMid(); renderSide(); return;
    }
    const ie = t.closest("[data-iedit]");
    if (ie) { e.stopPropagation(); startEdit(mineOf(ie.dataset.iedit)); return; }
    const idl = t.closest("[data-idel]");
    if (idl) {
      e.stopPropagation();
      arm(idl, () => {
        const id = idl.dataset.idel;
        deleteItem(id).then(() => {
          st.mine = st.mine.filter(m => m.id !== id);
          const s = { ...st.s, acc: st.s.acc.filter(a => a !== id) };
          for (const k of ["top", "bottom", "one", "outer", "shoes"]) if (s[k] === id) delete s[k];
          st.s = s; emit(); renderAll();
        }, () => flash(idl, "Couldn't"));
      });
      return;
    }
    const it = t.closest("[data-item]");
    if (it) { const m = mineOf(it.dataset.item); if (m) { st.cat = m.cat; st.mode = "build"; pick(m.cat, m.cat === "acc" && st.s.acc.includes(m.id) ? m.id : (st.s[m.cat] === m.id ? "" : m.id)); } return; }
    const idea = t.closest("[data-idea]");
    if (idea) {
      const x = IDEAS[+idea.dataset.idea];
      st.edit.guide = { fit: x.fit, color: x.color, fabric: x.fabric, item: x.item, detail: x.detail };
      st.edit.cat = x.cat; st.edit.text = composeDraft(st.edit); if (!st.edit.name) st.edit.name = x.name;
      renderMid(); renderSide(); return;
    }
    const x = t.closest("[data-x]");
    if (x) {
      const k = x.dataset.x;
      if (k === "close") close();
      else if (k === "done") { emit(); close(); }
      else if (k === "reset") { st.s = { on: true, swap: st.s.swap || "whole", acc: [] }; emit(); renderAll(); }
      else if (k === "on") { st.s = { ...st.s, on: st.s.on === false }; emit(); renderSide(); renderMid(); }
      else if (k === "copy") {
        const txt = outfitText(P()), lbl = x.querySelector("span");
        if (txt) navigator.clipboard.writeText(txt).then(() => { lbl.textContent = "Copied"; setTimeout(() => { lbl.textContent = "Copy"; }, 1400); }, () => { lbl.textContent = "Press Ctrl+C"; });
      }
      else if (k === "nextex") { st.ex++; renderMid(); }
      else if (k === "snew") { st.naming = true; renderSaved(); }
      else if (k === "ssave") commitSaved(q(".kqb-pname input").value);
      else if (k === "sexport") { const list = loadSaved(); if (!list.length) { flash(x, "Nothing yet"); return; } download(`call-sheet-outfits-${today()}.json`, { kind: "krea-pose-sheet-outfits", version: 1, outfits: list }); flash(x, `Saved ${list.length}`); }
      else if (k === "simport") { fileFor = "outfits"; q(".kqs-file").click(); }
      else if (k === "iexport") { if (!st.mine.length) { flash(x, "No items yet"); return; } download(`call-sheet-clothes-${today()}.json`, { kind: "krea-pose-sheet-outfit-items", version: 1, items: st.mine.map(({ cat, name, text, hex }) => ({ cat, name, text, hex })) }); flash(x, `Saved ${st.mine.length}`); }
      else if (k === "iimport") { fileFor = "items"; q(".kqs-file").click(); }
      else if (k === "newitem") startEdit(null);
      else if (k === "help") { st.help = !st.help; renderMid(); }
      else if (k === "ecancel") { st.mode = "items"; renderNav(); renderMid(); renderSide(); }
      else if (k === "esave") {
        const ed = st.edit;
        if (!ed.text.trim()) { q(".kqs-emsg").textContent = "Write the wording first, or use Help me write it."; q('[data-e="text"]').focus(); return; }
        x.disabled = true;
        saveItem({ id: ed.id, cat: ed.cat, name: ed.name || "My item", text: ed.text, hex: hexNow(ed) }).then(m => {
          const i = st.mine.findIndex(y => y.id === m.id);
          if (i >= 0) st.mine[i] = m; else st.mine.push(m);
          st.cat = m.cat; st.mode = "build";
          if (m.cat === "acc") { if (!st.s.acc.includes(m.id)) pick("acc", m.id); else { emit(); renderAll(); } }
          else pick(m.cat, m.id);
          renderSaved();
        }, err => { x.disabled = false; q(".kqs-emsg").textContent = err.message || "Couldn't save"; });
      }
      return;
    }
    const pr = t.closest("[data-preset]");
    if (pr) { const p = loadSaved()[+pr.dataset.preset]; if (p && p.state) loadPreset(p); return; }
    const pd = t.closest("[data-pdel]");
    if (pd) { arm(pd, () => { const list = loadSaved(); list.splice(+pd.dataset.pdel, 1); storeSaved(list); renderSaved(); }); return; }
    const c = t.closest("[data-cat]");
    if (c) { st.cat = c.dataset.cat; st.mode = "build"; renderNav(); renderMid(); return; }
    const o = t.closest("[data-val]");
    if (o) { pick(st.cat, o.dataset.val); return; }
    const s = t.closest("[data-step]");
    if (s) { const i = C.findIndex(y => y.key === st.cat); st.cat = C[(i + +s.dataset.step + C.length) % C.length].key; renderNav(); renderMid(); return; }
    const cl = t.closest("[data-clear]");
    if (cl) { if (cl.dataset.clear === "acc") pick("acc", cl.dataset.cv); else pick(cl.dataset.clear, ""); }
  });
  el.addEventListener("keydown", e => {
    const pc = e.target.closest && e.target.closest("[data-item]");
    if (pc && (e.key === "Enter" || e.key === " ") && e.target === pc) { e.preventDefault(); pc.click(); }
  });
  el.addEventListener("change", e => {
    if (!e.target.classList.contains("kqs-file")) return;
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (fileFor === "items") {
      const btn = q('[data-x="iimport"]');
      importItems(file).then(j => { st.mine = j.items; renderAll(); const b = q('[data-x="iimport"]'); if (b) flash(b, j.added ? `Added ${j.added}` : "No items found", 2500); },
        err => { if (btn) flash(btn, err.message || "Couldn't import", 3000); });
    } else {
      const btn = q('[data-x="simport"]');
      file.text().then(txt => {
        const j = JSON.parse(txt), items = Array.isArray(j) ? j : j.outfits;
        if (!Array.isArray(items)) throw new Error();
        const list = loadSaved();
        let n = 0;
        for (const x of items) if (x && typeof x === "object" && x.state && typeof x.state === "object") { list.push({ name: String(x.name || "").slice(0, 40) || genericName(list), state: x.state, items: Array.isArray(x.items) ? x.items : [] }); n++; }
        storeSaved(list); renderSaved();
        const b = q('[data-x="simport"]'); if (b) flash(b, n ? `Added ${n}` : "None found", 2500);
      }).catch(() => { if (btn) flash(btn, "Not an outfits file", 3000); });
    }
  });
  el.addEventListener("pointerdown", e => e.stopPropagation());
  document.addEventListener("keydown", onKey, true);
  renderAll();
  loadItems().then(list => { if (list) { st.mine = list; st.hasServer = true; renderAll(); } });
  q(".kqb-nav button[aria-current=true]")?.focus({ preventScroll: true });
  current = { el, close };
  return current;
}
