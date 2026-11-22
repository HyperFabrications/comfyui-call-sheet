// ComfyUI entry point: the Pose Sheet sidebar tab, the pose gallery, and the frame card on the Krea Pose Prompt node.
import { mountSheet } from "./sheet.js";
import { openGallery, localCtx, thumbHTML, snippet, editPrompt } from "./gallery.js";
import { openBuilder } from "./builder.js";
import { loadData, frameKey, frameNo, loadEdits, saveEdit, personText } from "./core.js";

const HERE = new URL(".", import.meta.url);
const NODE_TYPE = "KreaPosePrompt";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function getApp() {
  if (window.comfyAPI?.app?.app) return window.comfyAPI.app.app;
  return (await import("../../scripts/app.js")).app;
}

function addStyles() {
  if (document.getElementById("kps-css")) return;
  const link = document.createElement("link");
  link.id = "kps-css"; link.rel = "stylesheet"; link.href = new URL("sheet.css", HERE).href;
  document.head.appendChild(link);
  // Map the sheet's colors onto ComfyUI's theme.
  const st = document.createElement("style");
  st.textContent = `.kps{--kps-bg:var(--comfy-menu-bg,#202020);--kps-paper:var(--comfy-input-bg,#2a2a2a);--kps-ink:var(--input-text,var(--fg-color,#ddd));
    --kps-muted:var(--descrip-text,#999);--kps-line:var(--border-color,#444);--kps-code:var(--comfy-menu-secondary-bg,#1a1a1a);
    --kps-accent:#8b9cf7;--kps-accent-soft:rgba(139,156,247,.14);--kps-body:inherit;--kps-display:inherit;}`;
  document.head.appendChild(st);
}

function setWidget(node, name, value) {
  const w = node.widgets?.find(x => x.name === name);
  if (!w) return false;
  w.value = value;
  w.callback?.(value);
  return true;
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text; btn.classList.add("done");
  setTimeout(() => { btn.textContent = old; btn.classList.remove("done"); }, 1600);
}

function nodeEdits(node) {
  const w = node.widgets?.find(x => x.name === "edits");
  try { const e = JSON.parse(w?.value || "{}"); return e && typeof e === "object" ? e : {}; } catch (err) { return {}; }
}
function setNodeEdit(node, id, text) {
  const e = nodeEdits(node);
  if (text) e[id] = text; else delete e[id];
  setWidget(node, "edits", Object.keys(e).length ? JSON.stringify(e) : "");
}

const selectedNodes = app => Object.values(app.canvas?.selected_nodes || {});

// Put a Krea Pose Prompt node on the canvas (or reuse the selected one) set to this frame.
function sendToPoseNode(app, frame, mode, state, btn) {
  const LG = window.LiteGraph;
  let node = selectedNodes(app).find(n => n.type === NODE_TYPE);
  const isNew = !node;
  if (!node) {
    node = LG.createNode(NODE_TYPE);
    if (!node) { flash(btn, "Restart ComfyUI"); return; }
    const c = app.canvas, ds = c.ds;
    node.pos = [(-ds.offset[0]) + (c.canvas.width / ds.scale) / 2 - 160, (-ds.offset[1]) + (c.canvas.height / ds.scale) / 2 - 120];
    app.graph.add(node);
    app.canvas.selectNode?.(node);
  }
  setWidget(node, "frame", frameKey(frame));
  setWidget(node, "mode", mode);
  setWidget(node, "trigger", state.trigger);
  setWidget(node, "style", state.style);
  setWidget(node, "person", state.person);
  const mine = loadEdits();
  const ids = mode === "whole set" ? data.frames.filter(f => f.set === frame.set).map(f => f.id) : [frame.id];
  for (const id of ids) if (mine[id]) setNodeEdit(node, id, mine[id]);
  node._kpsDraw?.();
  app.graph.setDirtyCanvas(true, true);
  flash(btn, isNew ? "Node added" : "Node updated");
}

// Fill a selected text box (CLIP Text Encode and similar) with the finished prompt.
function sendToText(app, text, btn) {
  const node = selectedNodes(app).find(n => n.widgets?.some(w => w.name === "text" || w.name === "prompt"));
  if (!node) { flash(btn, "Select a text node first"); return; }
  setWidget(node, "text", text) || setWidget(node, "prompt", text);
  app.graph.setDirtyCanvas(true, true);
  flash(btn, "Sent");
}

// ---- preview images ----
let thumbs = {};
const thumbListeners = new Set();
async function refreshThumbs() {
  try { const r = await fetch("/krea_pose_sheet/thumbs", { cache: "no-store" }); if (r.ok) thumbs = await r.json(); } catch (e) {}
  thumbListeners.forEach(fn => fn());
  return thumbs;
}
async function setPreviewFromLastRender(fid) {
  const r = await fetch("/history?max_items=1", { cache: "no-store" });
  const hist = r.ok ? await r.json() : {};
  const run = Object.values(hist)[0];
  let img = null;
  for (const out of Object.values(run?.outputs || {})) for (const i of out.images || []) img = i;
  if (!img) throw new Error("No render yet. Run the workflow first.");
  const s = await fetch(`/krea_pose_sheet/thumb/${encodeURIComponent(fid)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(img) });
  const j = await s.json();
  if (!s.ok) throw new Error(j.error || "Couldn't save preview");
  thumbs[fid] = j.url;
  thumbListeners.forEach(fn => fn());
  return j.url;
}

const app = await getApp();
const data = await loadData(new URL("poses.json", HERE).href);
const byKey = new Map(data.frames.map(f => [frameKey(f), f]));
const byId = new Map(data.frames.map(f => [f.id, f]));
const frameOf = value => byKey.get(value) || byId.get(String(value || "").split(" · ")[0].trim()) || null;

const savedPicks = () => { try { return JSON.parse(localStorage.getItem("kps:person") || "{}") || {}; } catch (e) { return {}; } };

// The picker opened from a node reads and writes that node's widgets.
function nodeCtx(node) {
  const w = n => node.widgets?.find(x => x.name === n);
  const props = node.properties || (node.properties = {});
  const dirty = () => { node._kpsDraw?.(); node.setDirtyCanvas?.(true, true); };
  return {
    trigger: () => String(w("trigger")?.value ?? ""),
    setTrigger: v => { setWidget(node, "trigger", v); dirty(); },
    style: () => w("style")?.value !== false,
    person: () => {
      const text = String(w("person")?.value || "").trim();
      return { picks: props.kpsPicks || savedPicks(), on: !!text, text };
    },
    setPerson: ({ picks, on }) => {
      props.kpsPicks = picks;
      try { localStorage.setItem("kps:person", JSON.stringify(picks)); } catch (e) {}
      setWidget(node, "person", on ? personText(picks) : "");
      dirty();
    },
    // Your saved wording shows here too; the node's own copy wins.
    edits: () => ({ ...loadEdits(), ...nodeEdits(node) }),
    setEdit: (id, text) => { saveEdit(id, text); setNodeEdit(node, id, text); dirty(); },
  };
}

function personOpener(ctx, done) {
  const p = ctx.person();
  openBuilder({ data, picks: p.picks, on: p.on || !Object.values(p.picks || {}).some(Boolean), trigger: ctx.trigger(),
    onChange: ({ picks, on }) => { ctx.setPerson({ picks, on }); done(); } });
}

function galleryFor(node) {
  const w = node.widgets.find(x => x.name === "frame");
  const cur = frameOf(w.value);
  const ctx = nodeCtx(node);
  return openGallery({
    data, thumbs, current: cur ? cur.id : null, ctx, setPreview: setPreviewFromLastRender, openPerson: personOpener,
    primary: { label: "Use this frame", run: f => {
      w.value = frameKey(f); w.callback?.(w.value);
      const mode = node.widgets.find(x => x.name === "mode")?.value;
      const ids = mode === "whole set" ? data.frames.filter(x => x.set === f.set).map(x => x.id) : mode === "whole tab" ? data.frames.filter(x => x.tab === f.tab).map(x => x.id) : [f.id];
      const mine = ctx.edits();
      for (const id of ids) if (mine[id]) setNodeEdit(node, id, mine[id]);
      node._kpsDraw?.(); node.setDirtyCanvas?.(true, true);
      return true;
    } },
    actions: [{ label: "To text box", title: "Put this prompt in the selected CLIP Text Encode (or any node with a text box)", run: (_f, p, btn) => sendToText(app, p, btn) }],
  });
}

app.registerExtension({
  name: "krea.PoseSheet",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated?.apply(this, arguments);
      const node = this;
      const fw = node.widgets?.find(w => w.name === "frame");
      if (!fw || !node.addDOMWidget) return r;

      const wrap = document.createElement("div");
      wrap.className = "kps kpn";
      wrap.innerHTML = `<button type="button" class="kpn-face" title="Click to browse all frames"></button>
        <div class="kpn-bar"><button type="button" class="kps-btn" data-step="-1" title="Previous frame">‹</button>
        <button type="button" class="kps-btn kps-accent kpn-browse">Browse frames</button>
        <button type="button" class="kps-btn" data-step="1" title="Next frame">›</button>
        <button type="button" class="kps-btn kpn-edit" title="Rewrite this frame's prompt for this node">Edit prompt</button></div>`;
      const face = wrap.querySelector(".kpn-face");
      const draw = () => {
        const f = frameOf(fw.value);
        const ed = f && nodeEdits(node)[f.id];
        face.innerHTML = f ? `${thumbHTML(f, thumbs)}<span class="kpn-text"><span class="kpn-title"><span class="kps-no">${frameNo(f.id)}</span> ${esc(f.title)}${ed ? ' <span class="kps-badge kps-upd">Edited</span>' : ""}</span>
          <span class="kpg-set">${esc(data.tabs.find(t => t.id === f.tab)?.name || "")} · ${esc(data.sets[f.set] || "")}</span><span class="kpn-snip">${esc(snippet(ed ? { ...f, text: ed } : f))}</span></span>`
          : `<span class="kpn-text"><span class="kpn-title">Pick a frame</span></span>`;
      };
      wrap.addEventListener("click", e => {
        const step = e.target.closest("[data-step]");
        if (step) {
          const f = frameOf(fw.value);
          const i = f ? data.frames.indexOf(f) : -1;
          const next = data.frames[(i + +step.dataset.step + data.frames.length) % data.frames.length];
          fw.value = frameKey(next); fw.callback?.(fw.value); draw(); node.setDirtyCanvas?.(true, true);
          return;
        }
        if (e.target.closest(".kpn-edit")) {
          const f = frameOf(fw.value); if (!f) return;
          editPrompt({ frame: f, initial: nodeEdits(node)[f.id] || loadEdits()[f.id], onSave: txt => {
            setNodeEdit(node, f.id, txt); saveEdit(f.id, txt); draw(); node.setDirtyCanvas?.(true, true);
          } });
          return;
        }
        if (e.target.closest(".kpn-face, .kpn-browse")) galleryFor(node);
      });
      // Keep pointer events on the card from dragging the canvas.
      wrap.addEventListener("pointerdown", e => e.stopPropagation());

      const dom = node.addDOMWidget("frame_card", "kps_frame_card", wrap, { serialize: false, hideOnZoom: false });
      dom.computeSize = () => [0, 168];

      // The dropdown stays (hidden) so saved workflows and the API keep working.
      fw.hidden = true;
      fw.computeSize = () => [0, -4];
      const ew = node.widgets.find(w => w.name === "edits");
      if (ew) { ew.hidden = true; ew.computeSize = () => [0, -4]; }
      // Put the card where the dropdown was.
      const iw = node.widgets.indexOf(dom), ifw = node.widgets.indexOf(fw);
      if (iw > ifw + 1) { node.widgets.splice(iw, 1); node.widgets.splice(ifw + 1, 0, dom); }

      const cb = fw.callback;
      fw.callback = function (v) { const out = cb?.apply(this, arguments); draw(); return out; };
      node._kpsDraw = draw;
      thumbListeners.add(draw);
      const onRemoved = node.onRemoved;
      node.onRemoved = function () { thumbListeners.delete(draw); return onRemoved?.apply(this, arguments); };
      draw();
      node.setSize([Math.max(node.size[0], 340), node.computeSize()[1]]);
      return r;
    };
    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = onConfigure?.apply(this, arguments);
      this._kpsDraw?.();
      return r;
    };
  },

  async setup() {
    addStyles();
    refreshThumbs();
    let sheet = null;
    const sideGallery = () => refreshThumbs().then(() => openGallery({
      data, thumbs, ctx: localCtx(), setPreview: setPreviewFromLastRender, openPerson: personOpener,
      onClose: () => sheet?.reload(),
      primary: { label: "Send to node", run: (f, btn) => { sheet?.reload(); sendToPoseNode(app, f, "single frame", sheet ? sheet.state() : { trigger: "", style: true, person: "" }, btn); return false; } },
      actions: [{ label: "To text box", title: "Put this prompt in the selected CLIP Text Encode (or any node with a text box)", run: (_f, p, btn) => sendToText(app, p, btn) }],
    }));
    const render = el => {
      el.innerHTML = "";
      const root = document.createElement("div");
      root.style.cssText = "padding:0 12px;height:100%;overflow-y:auto;";
      el.appendChild(root);
      sheet = mountSheet(root, data, {
        compact: true,
        onGallery: sideGallery,
        actions: [
          { label: "To node", title: "Add a Krea Pose Prompt node set to this frame, or update the selected one", run: (f, _p, btn) => sendToPoseNode(app, f, "single frame", sheet.state(), btn) },
          { label: "To text box", title: "Put this prompt in the selected CLIP Text Encode (or any node with a text box)", run: (_f, p, btn) => sendToText(app, p, btn) },
        ],
        setActions: [
          { label: "Set to node", title: "Add a Krea Pose Prompt node that outputs this whole set as a list", run: (_s, frames, _p, btn) => frames.length && sendToPoseNode(app, frames[0], "whole set", sheet.state(), btn) },
        ],
      });
    };
    const reg = { id: "krea-pose-sheet", icon: "pi pi-images", title: "Pose Sheet", tooltip: "Krea Pose Sheet", type: "custom", render };
    if (app.extensionManager?.registerSidebarTab) app.extensionManager.registerSidebarTab(reg);
    else console.warn("[Krea Pose Sheet] This ComfyUI frontend has no sidebar API; update ComfyUI to see the Pose Sheet panel. The nodes still work.");
  },
});
