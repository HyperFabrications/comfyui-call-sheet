// Build a person: categories on the left, options in the middle, a live figure on the right.
// openBuilder({ data, picks, on, trigger, onChange({ picks, on }) }). Changes apply as you make them.
import { personText } from "./core.js";
import { SWATCH, figureSVG } from "./figure.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;
const COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

// "Tall woman, long auburn hair": the short label used in headers.
export function shortPerson(traits, picks) {
  const name = (k) => {
    const t = traits.find(x => x.key === k), v = picks && picks[k];
    const o = t && v ? t.options.find(x => x.value === v) : null;
    return o ? o.name.replace(/\s*\(.*\)$/, "").toLowerCase() : "";
  };
  const who = [name("height") === "average" ? "" : name("height"), name("gender") || (Object.values(picks || {}).some(Boolean) ? "person" : "")].filter(Boolean).join(" ");
  const hair = picks && picks.length === "shaved" ? "shaved head" : [name("length"), name("hcolor")].filter(Boolean).join(" ");
  const out = [who, hair && hair !== "shaved head" ? hair + " hair" : hair].filter(Boolean).join(", ");
  return out ? out[0].toUpperCase() + out.slice(1) : "";
}

let current = null;

export function openBuilder({ data, picks = {}, on = true, trigger = "", onChange = () => {} }) {
  if (current) current.close();
  const T = data.traits;
  const st = { cat: T[0].key, picks: { ...picks }, on };
  const nameOf = (t, v) => { const o = t.options.find(x => x.value === v); return o ? o.name : "Any"; };

  const el = document.createElement("div");
  el.className = "kq kq-builder";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Build a person");
  el.innerHTML = `<div class="kq-box">
    <header class="kq-head">
      <button type="button" class="kq-icon" data-x="close" aria-label="Back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h2>Person</h2>
      <span class="kq-dim">Anything left on Any is up to Krea 2</span>
      <span class="kq-grow"></span>
      <button type="button" class="kq-ghost" data-x="reset">Reset</button>
      <button type="button" class="kq-primary kq-sm" data-x="use">Use in prompts</button>
    </header>
    <div class="kqb-body">
      <nav class="kqb-nav" aria-label="Categories"></nav>
      <section class="kqb-opts">
        <div class="kqb-title"><h3></h3><span class="kq-dim"></span></div>
        <div class="kqb-grid"></div>
        <div class="kqb-steps">
          <button type="button" class="kq-ghost" data-step="-1"></button>
          <span class="kq-dim kqb-prog"></span>
          <button type="button" class="kq-ghost kq-filled" data-step="1"></button>
        </div>
      </section>
      <aside class="kqb-side">
        <div class="kqb-stage"><div class="kqb-fig"></div><div class="kqb-chips"></div></div>
        <div class="kqb-send">
          <div class="kq-row"><span class="kq-strong">Include in prompts</span><span class="kq-dim kqb-where"></span><span class="kq-grow"></span>
            <button type="button" class="kq-switch" data-x="toggle" aria-label="Include this person in prompts"><span></span></button></div>
          <p class="kq-mono kqb-desc"></p>
          <button type="button" class="kq-ghost kq-tight" data-x="copy">${COPY}<span>Copy</span></button>
        </div>
      </aside>
    </div>
  </div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);

  const emit = () => onChange({ picks: { ...st.picks }, on: st.on });

  function renderNav() {
    q(".kqb-nav").innerHTML = T.map(t => {
      const v = st.picks[t.key];
      return `<button type="button" data-cat="${t.key}" aria-current="${t.key === st.cat}"><span>${esc(t.label)}</span><span class="${v ? "" : "kq-faint"}">${esc(nameOf(t, v))}</span></button>`;
    }).join("");
  }
  function renderOpts() {
    const i = T.findIndex(t => t.key === st.cat), t = T[i];
    q(".kqb-title h3").textContent = t.label;
    q(".kqb-title span").textContent = st.picks.length === "shaved" && t.key === "htype" ? "Hair length is Shaved, so hair type won't show" : "";
    const sw = SWATCH[t.key];
    q(".kqb-grid").innerHTML = [{ value: "", name: "Any" }, ...t.options].map(o => {
      const on = (st.picks[t.key] || "") === o.value;
      return `<button type="button" class="kqb-opt" data-val="${esc(o.value)}" aria-pressed="${on}">${sw && sw[o.value] ? `<span class="kqb-sw" style="background:${sw[o.value]}"></span>` : ""}<span class="kq-grow">${esc(o.name)}</span>${on ? CHECK : ""}</button>`;
    }).join("");
    const prev = T[(i - 1 + T.length) % T.length], next = T[(i + 1) % T.length];
    q('[data-step="-1"]').textContent = "← " + prev.label;
    q('[data-step="1"]').textContent = next.label + " →";
    q(".kqb-prog").textContent = `${i + 1} of ${T.length}`;
  }
  function renderSide() {
    const d = personText(st.picks);
    q(".kqb-fig").innerHTML = figureSVG(st.picks, { label: d ? "Preview of " + d : "Neutral figure, nothing picked" });
    q(".kqb-chips").innerHTML = T.filter(t => st.picks[t.key]).map(t => `<button type="button" class="kq-chip" data-clear="${t.key}" aria-label="Clear ${esc(t.label)}">${esc(nameOf(t, st.picks[t.key]))}<span aria-hidden="true">×</span></button>`).join("");
    q('[data-x="toggle"]').setAttribute("aria-pressed", String(st.on));
    q(".kqb-where").textContent = st.on ? (trigger.trim() ? "after your trigger" : "in place of [trigger]") : "off";
    const desc = q(".kqb-desc");
    desc.classList.toggle("is-off", !st.on);
    desc.innerHTML = d ? `${trigger.trim() ? `<span class="kq-faint">${esc(trigger.trim())}, </span>` : ""}${esc(d)}` : `<span class="kq-faint">Pick a trait to start.</span>`;
  }
  const renderAll = () => { renderNav(); renderOpts(); renderSide(); };

  function set(k, v) {
    st.picks[k] = v;
    if (!v) delete st.picks[k];
    if (v && !st.on) st.on = true;
    emit(); renderNav(); renderOpts(); renderSide();
  }
  function close() {
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    if (current && current.el === el) current = null;
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }

  el.addEventListener("click", e => {
    const t = e.target;
    if (t === el) { close(); return; }
    const x = t.closest("[data-x]");
    if (x) {
      const k = x.dataset.x;
      if (k === "close") close();
      else if (k === "use") { st.on = true; emit(); close(); }
      else if (k === "reset") { st.picks = {}; emit(); renderAll(); }
      else if (k === "toggle") { st.on = !st.on; emit(); renderSide(); }
      else if (k === "copy") {
        const d = personText(st.picks), lbl = x.querySelector("span");
        if (d) navigator.clipboard.writeText(d).then(() => { lbl.textContent = "Copied"; setTimeout(() => { lbl.textContent = "Copy"; }, 1400); }, () => { lbl.textContent = "Press Ctrl+C"; });
      }
      return;
    }
    const c = t.closest("[data-cat]");
    if (c) { st.cat = c.dataset.cat; renderNav(); renderOpts(); return; }
    const o = t.closest("[data-val]");
    if (o) { set(st.cat, o.dataset.val); return; }
    const s = t.closest("[data-step]");
    if (s) { const i = T.findIndex(x => x.key === st.cat); st.cat = T[(i + +s.dataset.step + T.length) % T.length].key; renderNav(); renderOpts(); return; }
    const cl = t.closest("[data-clear]");
    if (cl) set(cl.dataset.clear, "");
  });
  el.addEventListener("pointerdown", e => e.stopPropagation());
  document.addEventListener("keydown", onKey, true);
  renderAll();
  q(".kqb-nav button[aria-current=true]")?.focus({ preventScroll: true });
  current = { el, close };
  return current;
}
