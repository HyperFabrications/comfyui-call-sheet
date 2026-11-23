// Pick the camera a shot was taken on, its flaws, and real skin.
// openCameraPicker({ data, cams, state, sample, onChange(state) }). Changes apply as you make them.
import { parts, cameraText, withCamera, cameraOf } from "./camera_core.js";
import { frameNo } from "./core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

// Little line drawings of each camera, for the picker and the node card.
const G = {
  "": `<rect x="3" y="5" width="18" height="14" rx="2" stroke-dasharray="2.5 2.5"/><path d="M8 12h8"/>`,
  phone: `<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 5h3"/><circle cx="12" cy="18.3" r=".7"/>`,
  mirror: `<rect x="3.5" y="2.5" width="11" height="19" rx="5.5"/><rect x="13" y="9" width="6.5" height="11" rx="1.4"/><path d="M15 11h2.5"/>`,
  flash: `<rect x="2.5" y="8" width="19" height="12" rx="2"/><circle cx="12" cy="14" r="3.4"/><path d="M5.5 5.5l2.5-2 .2 2.4 2.3-2.4"/><rect x="16" y="10" width="3.5" height="2" rx=".5"/>`,
  disposable: `<rect x="2.5" y="7" width="19" height="12" rx="1.5"/><circle cx="9" cy="13" r="3"/><rect x="15" y="9.5" width="4" height="3" rx=".5"/><path d="M5 7V5.5h4V7M15 15.5h4"/>`,
  slr: `<path d="M3 9.5h4l1.5-3h7l1.5 3h4v10H3z"/><circle cx="12" cy="14.5" r="4"/><circle cx="12" cy="14.5" r="1.8"/><path d="M5 12h1.5"/>`,
  digicam: `<rect x="3" y="6.5" width="18" height="12.5" rx="2.5"/><circle cx="14.5" cy="12.8" r="3.6"/><path d="M6 9.5h3M6 12h2"/><rect x="5" y="15" width="4" height="2" rx=".5"/>`,
};
export const cameraIcon = (value, size = 28) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[value] || G[""]}</svg>`;

let current = null;

export function openCameraPicker({ data, cams, state = {}, sample = null, onChange = () => {}, doneLabel = "Done" }) {
  if (current) current.close();
  const st = { s: { on: true, ...state }, ex: 0 };
  const samples = [sample, ...["69", "S36", "33", "S87"].map(id => data.frames.find(f => f.id === id))].filter((f, i, a) => f && a.findIndex(x => x && x.id === f.id) === i);

  const el = document.createElement("div");
  el.className = "kq kq-builder kqc";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Pick a camera");
  el.innerHTML = `<div class="kq-box">
    <header class="kq-head">
      <button type="button" class="kq-icon" data-x="close" aria-label="Back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h2>Camera</h2>
      <span class="kq-dim">What the shot was taken on</span>
      <span class="kq-grow"></span>
      <button type="button" class="kq-ghost" data-x="reset">Reset</button>
      <button type="button" class="kq-primary kq-sm" data-x="done">${esc(doneLabel)}</button>
    </header>
    <div class="kqc-body">
      <section class="kqb-opts kqc-mid"></section>
      <aside class="kqb-side kqc-side"></aside>
    </div>
  </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  const P = () => parts(cams, st.s);
  const emit = () => onChange({ ...st.s });

  function chips(items, chosen, attr) {
    return items.map(o => {
      const on = chosen && typeof chosen[o.key] === "boolean" ? chosen[o.key] : o.on;
      return `<button type="button" class="kq-chip kqc-tog" ${attr}="${esc(o.key)}" aria-pressed="${on}" title="${esc(o.text)}">${esc(o.name)}</button>`;
    }).join("");
  }
  function renderMid() {
    const c = cameraOf(cams, st.s.cam);
    q(".kqc-mid").innerHTML = `
      <div class="kqc-cams">${[{ value: "", name: "Frame's own", short: "Keep each frame's lens and finish" }, ...cams.cameras].map(o => `
        <button type="button" class="kqc-cam" data-cam="${esc(o.value)}" aria-pressed="${(st.s.cam || "") === o.value}">
          ${cameraIcon(o.value)}<span class="kqc-ct"><span class="kqc-cn">${esc(o.name)}</span><span class="kq-dim">${esc(o.short)}</span></span></button>`).join("")}</div>
      ${c ? `<div class="kqc-sec"><div class="kq-row"><span class="kq-strong">Flaws</span></div>
        <div class="kqc-chips">${chips(c.flaws, st.s.flaws, "data-flaw")}</div></div>` : ""}
      <div class="kqc-sec"><div class="kq-row"><span class="kq-strong">Real skin</span><span class="kq-grow"></span>
        <button type="button" class="kq-switch" data-x="skin" aria-pressed="${!!st.s.skin}" aria-label="Real skin"><span></span></button></div>
        ${st.s.skin ? `<div class="kqc-chips">${chips(cams.skin, st.s.skinBits, "data-skin")}</div>` : ""}</div>`;
  }
  function example() {
    if (!samples.length) return "";
    const f = samples[st.ex % samples.length], p = P();
    const [txt, changed] = withCamera(f.text, p);
    let html = esc(txt);
    if (changed) for (const s of [p.device, p.light, p.finish, p.flaws, p.skin].filter(Boolean)) {
      const e = esc(s), i = html.toLowerCase().indexOf(e.toLowerCase());
      if (i >= 0) html = html.slice(0, i) + `<mark>${html.slice(i, i + e.length)}</mark>` + html.slice(i + e.length);
    }
    return `<div class="kqs-ex kqc-ex">
      <div class="kq-row"><span class="kq-strong">On a frame</span><span class="kq-dim">${frameNo(f.id)} · ${esc(f.title)}</span><span class="kq-grow"></span>
        ${samples.length > 1 ? `<button type="button" class="kq-ghost kq-tight" data-x="nextex">Another</button>` : ""}</div>
      <p class="kqs-extext">${html.replace("[trigger]", '<span class="kq-faint">[trigger]</span>')}</p></div>`;
  }
  function renderSide() {
    const p = P(), txt = cameraText(p), c = cameraOf(cams, st.s.cam);
    q(".kqc-side").innerHTML = `${example()}
      <div class="kqb-send">
        <div class="kq-row"><span class="kq-strong">Use this camera</span><span class="kq-dim">${st.s.on === false ? "off, frames keep their own" : "on every frame"}</span><span class="kq-grow"></span>
          <button type="button" class="kq-switch" data-x="on" aria-pressed="${st.s.on !== false}" aria-label="Use this camera in prompts"><span></span></button></div>
        <p class="kq-mono kqb-desc${st.s.on === false ? " is-off" : ""}">${txt ? esc(txt) : `<span class="kq-faint">${c ? "" : "Pick a camera or turn on real skin."}</span>`}</p>
        <button type="button" class="kq-ghost kq-tight" data-x="copy">${COPY}<span>Copy</span></button>
      </div>`;
  }
  const render = () => { renderMid(); renderSide(); };

  function toggle(group, key, items) {
    const o = items.find(x => x.key === key); if (!o) return;
    const cur = { ...(st.s[group] || {}) };
    const now = typeof cur[key] === "boolean" ? cur[key] : o.on;
    if (!now === o.on) delete cur[key]; else cur[key] = !now;
    st.s = { ...st.s, [group]: cur, on: true };
    if (!Object.keys(cur).length) delete st.s[group];
    emit(); render();
  }
  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (current && current.el === el) current = null;
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el) { close(); return; }
    const cm = t.closest("[data-cam]");
    if (cm) {
      const v = cm.dataset.cam;
      st.s = { ...st.s, on: true };
      if (v) st.s.cam = v; else delete st.s.cam;
      delete st.s.flaws; // each camera starts from its own flaws
      emit(); render(); return;
    }
    const fl = t.closest("[data-flaw]");
    if (fl) { const c = cameraOf(cams, st.s.cam); if (c) toggle("flaws", fl.dataset.flaw, c.flaws); return; }
    const sk = t.closest("[data-skin]");
    if (sk) { toggle("skinBits", sk.dataset.skin, cams.skin); return; }
    const x = t.closest("[data-x]");
    if (!x) return;
    const k = x.dataset.x;
    if (k === "close") close();
    else if (k === "done") { emit(); close(); }
    else if (k === "reset") { st.s = { on: true }; emit(); render(); }
    else if (k === "on") { st.s.on = st.s.on === false; emit(); renderSide(); }
    else if (k === "skin") { st.s = { ...st.s, skin: !st.s.skin, on: true }; if (!st.s.skin) delete st.s.skin; emit(); render(); }
    else if (k === "nextex") { st.ex++; renderSide(); }
    else if (k === "copy") {
      const txt = cameraText(P()), lbl = x.querySelector("span");
      if (txt) navigator.clipboard.writeText(txt).then(() => { lbl.textContent = "Copied"; setTimeout(() => { lbl.textContent = "Copy"; }, 1400); }, () => { lbl.textContent = "Press Ctrl+C"; });
    }
  });
  el.addEventListener("pointerdown", e => e.stopPropagation());
  document.addEventListener("keydown", onKey, true);
  render();
  q(".kqc-cam[aria-pressed=true]")?.focus({ preventScroll: true });
  current = { el, close };
  return current;
}
