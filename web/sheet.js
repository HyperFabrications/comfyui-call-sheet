// The Pose Sheet interface, shared by the ComfyUI sidebar and the web page.
// mountSheet(root, data, { actions, setActions, compact }) renders it into root.
import { promptFor, personText, subject, frameNo, loadEdits, saveEdit } from "./core.js";
import { editPrompt } from "./gallery.js";

const store = {
  get(k) { try { return localStorage.getItem("kps:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("kps:" + k, v); } catch (e) {} },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NEW_DAYS = 21;

async function copyText(text, btn, label) {
  const done = ok => { btn.textContent = ok ? "Copied" : "Press Ctrl+C"; btn.classList.toggle("done", ok); setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, 1400); };
  try { await navigator.clipboard.writeText(text); done(true); return; } catch (e) {}
  const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
  ta.remove(); done(ok);
}

export function mountSheet(root, data, opts = {}) {
  const actions = opts.actions || [];       // [{ label, title, run(frame, prompt) }]
  const setActions = opts.setActions || []; // [{ label, title, run(setId, frames, prompts) }]
  const TABNAME = Object.fromEntries(data.tabs.map(t => [t.id, t.name]));
  const ORDER = Object.fromEntries(data.tabs.map(t => [t.id, t.sets]));
  const SETTAB = {};
  for (const t of data.tabs) for (const s of t.sets) SETTAB[s] = t.id;
  ORDER.all = data.tabs.flatMap(t => t.sets);
  ORDER.starred = ORDER.all;
  const TABS = ["all", ...data.tabs.map(t => t.id), "starred"];
  const FR = data.frames;
  const isNew = d => d.added && (Date.parse(data.updated) - Date.parse(d.added)) / 864e5 <= NEW_DAYS;
  const isUpd = d => !isNew(d) && d.upd && (Date.parse(data.updated) - Date.parse(d.upd)) / 864e5 <= NEW_DAYS;

  let tab = TABS.includes(store.get("tab")) ? store.get("tab") : "all";
  let set = "All";
  let styleOn = store.get("styleOn") !== "0";
  let personOn = store.get("personOn") === "1";
  let person = {}; try { person = JSON.parse(store.get("person") || "{}"); } catch (e) {}
  let favs = new Set(); try { favs = new Set(JSON.parse(store.get("favs") || "[]")); } catch (e) {}
  const label = s => (tab === "all" || tab === "starred") ? TABNAME[SETTAB[s]] + " · " + data.sets[s] : data.sets[s];

  root.classList.add("kps");
  if (opts.compact) root.classList.add("kps-compact");
  root.innerHTML = `
    <div class="kps-bar">
      ${opts.onGallery ? `<button type="button" class="kps-btn kps-accent kps-gallery-btn" data-k="gallery">Open the pose gallery</button>` : ""}
      <div class="kps-tabs" role="tablist" aria-label="Prompt set">${TABS.map(t => `<button type="button" role="tab" data-tab="${t}">${t === "all" ? "All" : t === "starred" ? "★ Starred" : esc(TABNAME[t])} <span class="kps-n" data-count="${t}"></span></button>`).join("")}</div>
      <div class="kps-row">
        <label class="kps-field kps-trigger"><span>Trigger</span><input type="text" data-k="trigger" placeholder="[trigger]" autocomplete="off" spellcheck="false"></label>
        <label class="kps-field kps-search"><span>Find</span><input type="search" data-k="search" placeholder="flash, curtain, overhead…" autocomplete="off"></label>
      </div>
      <div class="kps-row">
        <button type="button" class="kps-toggle" data-k="style" title="Turn off to strip medium, film and color words for LoRA use"><span class="kps-sw"></span><span class="kps-tl">Style</span></button>
        <button type="button" class="kps-toggle" data-k="person" title="Add the person from Build a person to every prompt"><span class="kps-sw"></span><span class="kps-tl">Person</span></button>
        <button type="button" class="kps-btn" data-k="builder" aria-expanded="false">Build a person</button>
      </div>
      <div class="kps-builder" hidden>
        <p class="kps-muted">No character LoRA? Pick a few traits. Leave anything on Any and Krea 2 decides. With Person on, this goes after your trigger, or in its place if the trigger is empty.</p>
        <div class="kps-picks">${data.traits.map(t => `<label class="kps-pick"><span>${esc(t.label)}</span><select data-trait="${t.key}"><option value="">Any</option>${t.options.map(o => `<option value="${esc(o.value)}">${esc(o.name)}</option>`).join("")}</select></label>`).join("")}</div>
        <pre class="kps-prompt" data-k="personText"></pre>
        <div class="kps-row"><button type="button" class="kps-btn" data-k="personCopy">Copy description</button><button type="button" class="kps-btn" data-k="personReset">Reset</button><span class="kps-muted" data-k="personHint"></span></div>
      </div>
      <div class="kps-chips" role="group" aria-label="Sets"></div>
    </div>
    <div class="kps-frames" aria-live="polite"></div>`;

  const q = s => root.querySelector(s);
  const trig = q('[data-k="trigger"]'), search = q('[data-k="search"]');
  trig.value = store.get("trigger") || "";
  root.querySelectorAll("select[data-trait]").forEach(s => { s.value = person[s.dataset.trait] || ""; });

  const pdesc = () => personOn ? personText(person) : "";
  let edits = loadEdits();
  const prompt = d => promptFor(d, { trigger: trig.value, person: pdesc(), style: styleOn, edits });
  const visible = () => {
    const s = search.value.trim().toLowerCase();
    return FR.filter(d => (tab === "all" || d.tab === tab || (tab === "starred" && favs.has(d.id))) && (set === "All" || d.set === set) &&
      (!s || (d.title + " " + d.text).toLowerCase().includes(s)));
  };

  function applyToggles() {
    const st = q('[data-k="style"]'), pe = q('[data-k="person"]');
    st.setAttribute("aria-pressed", String(styleOn)); st.querySelector(".kps-tl").textContent = styleOn ? "Style on" : "Style off";
    pe.setAttribute("aria-pressed", String(personOn)); pe.querySelector(".kps-tl").textContent = personOn ? "Person on" : "Person off";
    const d = personText(person);
    q('[data-k="personText"]').textContent = d || "Pick a trait to start.";
    const hint = [];
    if (personOn && !d) hint.push("Pick at least one trait to add a person.");
    if (person.gender === "man") hint.push("Most prompts say her and she; swap pronouns after copying.");
    if (personOn && trig.value.trim()) hint.push("Your trigger stays first, so a LoRA still leads.");
    q('[data-k="personHint"]').textContent = hint.join(" ");
  }

  function counts() {
    for (const t of TABS) {
      const n = t === "all" ? FR.length : t === "starred" ? FR.filter(d => favs.has(d.id)).length : FR.filter(d => d.tab === t).length;
      q(`[data-count="${t}"]`).textContent = n;
    }
  }

  function highlight(text) {
    const s = search.value.trim();
    let html = esc(text);
    const subj = esc(subject(trig.value, pdesc()));
    html = html.replace(subj, `<mark>${subj}</mark>`);
    if (s.length > 1) {
      const re = new RegExp("(" + esc(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      html = html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag ? tag : txt.replace(re, '<mark class="kps-hit">$1</mark>'));
    }
    return html;
  }

  function render() {
    edits = loadEdits();
    root.querySelectorAll(".kps-tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    const inTab = FR.filter(d => tab === "all" || d.tab === tab || (tab === "starred" && favs.has(d.id)));
    q(".kps-chips").innerHTML = ["All", ...ORDER[tab]].map(s => {
      const c = s === "All" ? inTab.length : inTab.filter(d => d.set === s).length;
      if (s !== "All" && !c) return "";
      return `<button type="button" class="kps-chip" data-set="${s}" aria-pressed="${s === set}">${s === "All" ? "All sets" : esc(label(s))}<span class="kps-c">${c}</span></button>`;
    }).join("");
    const list = visible();
    const box = q(".kps-frames");
    if (!list.length) {
      box.innerHTML = tab === "starred" && !favs.size ? `<div class="kps-empty">Nothing starred yet. Tap ☆ on any frame to keep it here.</div>` : `<div class="kps-empty">No frames match “${esc(search.value)}”. Clear the search or pick another set.</div>`;
      return;
    }
    let h = "";
    for (const g of ORDER[tab]) {
      const items = list.filter(d => d.set === g);
      if (!items.length) continue;
      h += `<div class="kps-group"><h3>${esc(label(g))}</h3><span class="kps-muted">${items.length} frame${items.length > 1 ? "s" : ""}</span><span class="kps-grow"></span><button type="button" class="kps-btn" data-copyset="${g}">Copy set</button>${setActions.map((a, i) => `<button type="button" class="kps-btn kps-accent" data-setaction="${i}" data-set-id="${g}" title="${esc(a.title || "")}">${esc(a.label)}</button>`).join("")}</div>`;
      for (const d of items) {
        const text = prompt(d), words = text.split(/\s+/).length;
        h += `<article class="kps-frame" id="kps-f-${esc(d.id)}">
          <div class="kps-top"><span class="kps-no">${frameNo(d.id)}</span><h4>${esc(d.title)}</h4>${isNew(d) ? '<span class="kps-badge">New</span>' : isUpd(d) ? '<span class="kps-badge kps-upd">Updated</span>' : ""}${edits[d.id] ? '<span class="kps-badge kps-upd">Edited</span>' : ""}
          <span class="kps-words">${words} words</span></div>
          <pre class="kps-prompt">${highlight(text)}</pre>
          ${d.note ? `<p class="kps-note"><b>Why it works:</b> ${esc(d.note)}</p>` : ""}
          <div class="kps-actions"><button type="button" class="kps-star" data-star="${esc(d.id)}" aria-pressed="${favs.has(d.id)}" aria-label="Star ${esc(d.title)}">${favs.has(d.id) ? "★" : "☆"}</button><button type="button" class="kps-btn" data-copy="${esc(d.id)}">Copy prompt</button><button type="button" class="kps-btn" data-edit="${esc(d.id)}">Edit</button>${actions.map((a, i) => `<button type="button" class="kps-btn kps-accent" data-action="${i}" data-id="${esc(d.id)}" title="${esc(a.title || "")}">${esc(a.label)}</button>`).join("")}
          ${d.ex || d.src ? `<span class="kps-refs">${d.ex ? `<a href="${esc(d.ex)}" target="_blank" rel="noopener noreferrer">Example</a>` : ""}${d.src ? `<a href="${esc(d.src)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}</span>` : ""}</div>
        </article>`;
      }
    }
    box.innerHTML = h;
  }

  root.addEventListener("click", e => {
    const t = e.target;
    if (t.closest('[data-k="gallery"]')) { opts.onGallery(); return; }
    const pr = opts.compact && t.closest(".kps-frame .kps-prompt");
    if (pr && !String(getSelection && getSelection()).length) { pr.closest(".kps-frame").classList.toggle("is-open"); return; }
    const tb = t.closest(".kps-tabs button");
    if (tb) { tab = tb.dataset.tab; set = "All"; store.set("tab", tab); render(); return; }
    const ch = t.closest(".kps-chip");
    if (ch) { set = ch.dataset.set; render(); return; }
    if (t.closest('[data-k="style"]')) { styleOn = !styleOn; store.set("styleOn", styleOn ? "1" : "0"); applyToggles(); render(); return; }
    if (t.closest('[data-k="person"]')) {
      personOn = !personOn; store.set("personOn", personOn ? "1" : "0");
      if (personOn && !personText(person)) openBuilder(true);
      applyToggles(); render(); return;
    }
    if (t.closest('[data-k="builder"]')) { openBuilder(q(".kps-builder").hidden); return; }
    if (t.closest('[data-k="personReset"]')) { person = {}; store.set("person", "{}"); root.querySelectorAll("select[data-trait]").forEach(s => { s.value = ""; }); applyToggles(); render(); return; }
    const pc = t.closest('[data-k="personCopy"]');
    if (pc) { const d = personText(person); if (d) copyText(d, pc, "Copy description"); return; }
    const st = t.closest("[data-star]");
    if (st) {
      const id = st.dataset.star;
      favs.has(id) ? favs.delete(id) : favs.add(id); store.set("favs", JSON.stringify([...favs])); counts();
      if (tab === "starred") { render(); return; }
      st.setAttribute("aria-pressed", String(favs.has(id))); st.textContent = favs.has(id) ? "★" : "☆";
      return;
    }
    const cs = t.closest("[data-copyset]");
    if (cs) { copyText(visible().filter(d => d.set === cs.dataset.copyset).map(prompt).join("\n"), cs, "Copy set"); return; }
    const cp = t.closest("[data-copy]");
    if (cp) { copyText(prompt(FR.find(d => d.id === cp.dataset.copy)), cp, "Copy prompt"); return; }
    const ed = t.closest("[data-edit]");
    if (ed) { const d = FR.find(x => x.id === ed.dataset.edit); editPrompt({ frame: d, initial: loadEdits()[d.id], onSave: txt => { saveEdit(d.id, txt); render(); } }); return; }
    const ac = t.closest("[data-action]");
    if (ac) { const d = FR.find(x => x.id === ac.dataset.id); actions[+ac.dataset.action].run(d, prompt(d), ac); return; }
    const sa = t.closest("[data-setaction]");
    if (sa) { const fr = visible().filter(d => d.set === sa.dataset.setId); setActions[+sa.dataset.setaction].run(sa.dataset.setId, fr, fr.map(prompt), sa); }
  });
  function openBuilder(open) {
    q(".kps-builder").hidden = !open;
    q('[data-k="builder"]').setAttribute("aria-expanded", String(open));
  }
  root.addEventListener("change", e => {
    const k = e.target.dataset && e.target.dataset.trait; if (!k) return;
    person[k] = e.target.value; store.set("person", JSON.stringify(person));
    if (personText(person) && !personOn) { personOn = true; store.set("personOn", "1"); }
    applyToggles(); render();
  });
  trig.addEventListener("input", () => { store.set("trigger", trig.value); applyToggles(); render(); });
  search.addEventListener("input", render);

  counts(); applyToggles(); render();
  return {
    state: () => ({ trigger: trig.value, style: styleOn, person: pdesc(), picks: { ...person }, edits: loadEdits() }),
    rerender: render,
  };
}
