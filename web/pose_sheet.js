// ComfyUI entry point: the Pose Sheet sidebar tab, the pose gallery, and the frame card on the Krea Pose Prompt node.
import { mountSheet } from "./sheet.js";
import { openGallery, localCtx, thumbHTML, snippet, editPrompt } from "./gallery.js";
import { openBuilder, shortPerson } from "./builder.js";
import { avatarSVG } from "./figure.js";
import { mergeCustom } from "./custom.js";
import { openSceneBuilder, loadPlaces } from "./scene.js";
import { sceneSVG, kindOf, timeOf } from "./scene_art.js";
import { places as placeList, parts as sceneParts, locked as sceneLocked } from "./scene_core.js";
import { openOutfitBuilder, loadItems } from "./outfit.js";
import { outfitSVG } from "./outfit_art.js";
import { parts as outfitParts, locked as outfitLocked, outfitText, withOutfit } from "./outfit_core.js";
import { withScene } from "./scene_core.js";
import { openCameraPicker, cameraIcon } from "./camera.js";
import { parts as cameraParts, cameraText, labelOf as cameraLabel } from "./camera_core.js";
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

function flash(btn, text, ms = 1600) {
  if (!btn) return;
  const lbl = btn.querySelector("span:last-child") || btn;
  if (btn._kpsOld == null) btn._kpsOld = lbl.textContent;
  clearTimeout(btn._kpsT);
  lbl.textContent = text; btn.classList.add("done");
  btn._kpsT = setTimeout(() => { lbl.textContent = btn._kpsOld; btn._kpsOld = null; btn.classList.remove("done"); }, ms);
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

// Fill a text box (CLIP Text Encode and similar) with the finished prompt.
// Uses the selected text node; if none is selected, the one feeding a sampler's positive input, or the only text node on the canvas.
const TEXT_NAMES = ["text", "prompt", "positive", "text_g", "t5xxl", "string", "value"];
function textWidget(node) {
  if (!node || /^KreaPose/.test(node.type || "") || node.mode === 4) return null;
  const ws = (node.widgets || []).filter(w => !w.hidden && (w.type === "customtext" || w.options?.multiline || w.element?.tagName === "TEXTAREA" || (typeof w.value === "string" && TEXT_NAMES.includes(w.name))));
  return ws.find(w => TEXT_NAMES.includes(w.name) && (w.type === "customtext" || w.options?.multiline || w.element?.tagName === "TEXTAREA")) || ws[0] || null;
}
function feedsPositive(app, node) {
  for (const out of node.outputs || []) for (const id of out.links || []) {
    const l = app.graph.links?.get ? app.graph.links.get(id) : app.graph.links?.[id];
    const t = l && app.graph.getNodeById(l.target_id);
    const inp = t?.inputs?.[l.target_slot];
    if (inp && /positive|conditioning|prompt|text/i.test(inp.name) && !/negative/i.test(inp.name)) return true;
  }
  return false;
}
function textTarget(app) {
  const sel = selectedNodes(app).filter(n => textWidget(n));
  if (sel.length) return sel[0];
  const all = (app.graph?._nodes || app.graph?.nodes || []).filter(n => textWidget(n));
  if (all.length === 1) return all[0];
  const pos = all.filter(n => feedsPositive(app, n));
  return pos.length === 1 ? pos[0] : null;
}
function sendToText(app, text, btn) {
  const node = textTarget(app);
  if (!node) {
    const any = (app.graph?._nodes || app.graph?.nodes || []).some(n => textWidget(n));
    flash(btn, any ? "Select the text node first" : "Add a text node first", 2600);
    return;
  }
  const w = textWidget(node);
  w.value = text;
  w.callback?.(text);
  if (w.element && "value" in w.element) w.element.value = text;
  node.setDirtyCanvas?.(true, true);
  app.graph.setDirtyCanvas(true, true);
  app.canvas?.selectNode?.(node);
  flash(btn, "Sent to " + String(node.title || node.type).replace(/\s*\(.*\)\s*$/, "").slice(0, 26), 2200);
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
await mergeCustom(data);
const scenes = await loadData(new URL("scenes.json", HERE).href).catch(() => null);
let myPlaces = (await loadPlaces()) || [];
const allPlaces = () => scenes ? placeList(scenes, data.frames, myPlaces) : [];
const SCENE_TYPE = "KreaPoseScene";
const sceneState = node => { try { const v = JSON.parse(node.widgets?.find(w => w.name === "scene")?.value || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
// The Krea Pose Scene node linked to a prompt node's scene input, if any.
function linkedScene(node) {
  const inp = node.inputs?.find(i => i.name === "scene");
  const link = inp && inp.link != null ? app.graph.links?.[inp.link] || app.graph.links?.get?.(inp.link) : null;
  const src = link ? app.graph.getNodeById(link.origin_id) : null;
  return src && src.type === SCENE_TYPE && src.mode !== 4 ? src : null;
}
function nodeOverrides(node) {
  try { const v = JSON.parse(node.widgets?.find(w => w.name === "scene_overrides")?.value || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
// The outfit, from a linked Call Sheet Outfit node.
const outfits = await loadData(new URL("outfits.json", HERE).href).catch(() => null);
let myItems = (await loadItems()) || [];
const OUTFIT_TYPE = "KreaPoseOutfit";
const outfitState = node => { try { const v = JSON.parse(node.widgets?.find(w => w.name === "outfit")?.value || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
function linkedOutfit(node) {
  const inp = node.inputs?.find(i => i.name === "outfit");
  const link = inp && inp.link != null ? app.graph.links?.[inp.link] || app.graph.links?.get?.(inp.link) : null;
  const src = link ? app.graph.getNodeById(link.origin_id) : null;
  return src && src.type === OUTFIT_TYPE && src.mode !== 4 ? src : null;
}
function outfitOverrides(node) {
  try { const v = JSON.parse(node.widgets?.find(w => w.name === "outfit_overrides")?.value || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
// The camera, from a linked Call Sheet Camera node.
const cams = await loadData(new URL("cameras.json", HERE).href).catch(() => null);
const CAMERA_TYPE = "KreaPoseCamera";
const cameraState = node => { try { const v = JSON.parse(node.widgets?.find(w => w.name === "camera")?.value || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
function linkedCamera(node) {
  const inp = node.inputs?.find(i => i.name === "camera");
  const link = inp && inp.link != null ? app.graph.links?.[inp.link] || app.graph.links?.get?.(inp.link) : null;
  const src = link ? app.graph.getNodeById(link.origin_id) : null;
  return src && src.type === CAMERA_TYPE && src.mode !== 4 ? src : null;
}
// The look of a scene for the little previews: its location's kind and time.
function sceneLook(s) {
  const pl = s.place ? allPlaces().find(p => p.id === s.place) : null;
  const loc = s.location && scenes ? scenes.categories[0].options.find(o => o.value === s.location) : null;
  return { kind: pl ? kindOf(pl.title + " " + pl.bg) : loc ? loc.kind : "none", time: pl ? timeOf(pl.light + " " + pl.bg) : "" };
}
// Looked up live, so prompts you add in the Custom tab are found too.
const frameOf = value => {
  const v = String(value || "");
  return data.frames.find(f => frameKey(f) === v) || data.frames.find(f => f.id === v.split(" · ")[0].trim()) || null;
};

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
      const picks = props.kpsPicks || savedPicks(), built = personText(picks);
      // Typed straight into the node's person box counts as your own wording too.
      const custom = props.kpsPersonText || (text && text !== built ? text : "");
      return { picks, on: !!text, text, custom };
    },
    setPerson: ({ picks, on, text }) => {
      props.kpsPicks = picks;
      if (text !== undefined) props.kpsPersonText = text || "";
      try { localStorage.setItem("kps:person", JSON.stringify(picks)); } catch (e) {}
      setWidget(node, "person", on ? (props.kpsPersonText || personText(picks)) : "");
      dirty();
    },
    // Your saved wording shows here too; the node's own copy wins.
    edits: () => ({ ...loadEdits(), ...nodeEdits(node) }),
    setEdit: (id, text) => { saveEdit(id, text); setNodeEdit(node, id, text); dirty(); },
    // The scene comes from a linked Krea Pose Scene node.
    scene: () => {
      const src = linkedScene(node);
      if (!src || !scenes) return null;
      const st = sceneState(src), p = sceneParts(scenes, st, allPlaces());
      return p.on ? { parts: p, label: p.label || (p.extra ? "Your scene" : "") } : null;
    },
    // The outfit comes from a linked Call Sheet Outfit node.
    outfit: () => {
      const src = linkedOutfit(node);
      if (!src || !outfits) return null;
      const p = outfitParts(outfits, outfitState(src), myItems);
      return p.on && p.pieces.length ? { parts: p, label: p.swap === "pick" ? "just what you picked" : "whole outfit" } : null;
    },
    // The camera comes from a linked Call Sheet Camera node.
    camera: () => {
      const src = linkedCamera(node);
      if (!src || !cams) return null;
      const p = cameraParts(cams, cameraState(src));
      return p.on && (p.cam || p.look || p.skin) ? { parts: p, label: cameraLabel(p) } : null;
    },
    outfitOverrides: () => outfitOverrides(node),
    setOutfitOverride: (id, on) => {
      const o = outfitOverrides(node).filter(x => x !== id);
      if (on) o.push(id);
      setWidget(node, "outfit_overrides", o.length ? JSON.stringify(o) : "");
      dirty();
    },
    overrides: () => nodeOverrides(node),
    setOverride: (id, on) => {
      const o = nodeOverrides(node).filter(x => x !== id);
      if (on) o.push(id);
      setWidget(node, "scene_overrides", o.length ? JSON.stringify(o) : "");
      dirty();
    },
  };
}

function personOpener(ctx, done) {
  const p = ctx.person();
  openBuilder({ data, picks: p.picks, text: p.custom || "", on: p.on || !Object.values(p.picks || {}).some(Boolean), trigger: ctx.trigger(),
    onChange: ({ picks, text, on }) => { ctx.setPerson({ picks, on, text }); done(); } });
}

function galleryFor(node) {
  const w = node.widgets.find(x => x.name === "frame");
  const cur = frameOf(w.value);
  const ctx = nodeCtx(node);
  return openGallery({
    data, scenes, outfits, thumbs, current: cur ? cur.id : null, ctx, setPreview: setPreviewFromLastRender, openPerson: personOpener,
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

// The Krea Pose Person node: a card with the figure's avatar and a button that opens the person builder.
// The trait dropdowns stay (hidden) so saved workflows and the API keep working.
function addPersonCard(nodeType) {
  const onNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    const r = onNodeCreated?.apply(this, arguments);
    const node = this;
    const traitWs = data.traits.map(t => [t, node.widgets?.find(w => w.name === t.key)]).filter(([, w]) => w);
    if (!node.addDOMWidget || !traitWs.length) return r;
    const picks = () => Object.fromEntries(traitWs.map(([t, w]) => [t.key, (t.options.find(o => o.name === w.value) || {}).value || ""]).filter(([, v]) => v));
    const wrap = document.createElement("div");
    wrap.className = "kps kpn kpp";
    wrap.innerHTML = `<button type="button" class="kpn-face kpp-face" title="Open the person builder"></button>
      <div class="kpn-bar"><button type="button" class="kps-btn kps-accent kpn-browse">Build person</button></div>`;
    const face = wrap.querySelector(".kpp-face");
    const ww = node.widgets?.find(w => w.name === "wording");
    if (ww) { ww.hidden = true; ww.computeSize = () => [0, -4]; }
    const draw = () => {
      const p = picks(), d = String(ww?.value || "").trim() || personText(p);
      face.innerHTML = `${avatarSVG(p, 44)}<span class="kpn-text"><span class="kpn-title">${esc(shortPerson(data.traits, p) || "Anyone")}</span>
        <span class="kpn-snip">${esc(d || "Nothing picked yet, so Krea 2 decides who is in the shot.")}</span></span>`;
    };
    const open = () => openBuilder({
      data, picks: picks(), text: String(ww?.value || "").trim(), on: true, toggle: false, doneLabel: "Done",
      onChange: ({ picks: p, text }) => {
        if (ww) { ww.value = text || ""; ww.callback?.(ww.value); }
        for (const [t, w] of traitWs) { const o = t.options.find(x => x.value === p[t.key]); w.value = o ? o.name : "Any"; w.callback?.(w.value); }
        draw(); node.setDirtyCanvas?.(true, true);
      },
    });
    wrap.addEventListener("click", e => { if (e.target.closest(".kpp-face, .kpn-browse")) open(); });
    wrap.addEventListener("pointerdown", e => e.stopPropagation());
    const dom = node.addDOMWidget("person_card", "kps_person_card", wrap, { serialize: false, hideOnZoom: false });
    dom.computeSize = () => [0, 112];
    for (const [, w] of traitWs) { w.hidden = true; w.computeSize = () => [0, -4]; const cb = w.callback; w.callback = function () { const o = cb?.apply(this, arguments); draw(); return o; }; }
    node._kpsDraw = draw;
    draw();
    node.setSize([Math.max(node.size[0], 300), node.computeSize()[1]]);
    return r;
  };
  const onConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () { const r = onConfigure?.apply(this, arguments); this._kpsDraw?.(); return r; };
}

// The Krea Pose Scene node: a little picture of the scene and a button that opens the scene builder.
function addSceneCard(nodeType) {
  const onNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    const r = onNodeCreated?.apply(this, arguments);
    const node = this;
    const sw = node.widgets?.find(w => w.name === "scene");
    if (!sw || !node.addDOMWidget || !scenes) return r;
    const wrap = document.createElement("div");
    wrap.className = "kps kpn kpsc";
    wrap.innerHTML = `<button type="button" class="kpn-face kpsc-face" title="Open the scene builder"></button>
      <div class="kpn-bar"><button type="button" class="kps-btn kps-accent kpn-browse">Build scene</button></div>`;
    const face = wrap.querySelector(".kpsc-face");
    const draw = () => {
      const s = sceneState(node), p = sceneParts(scenes, s, allPlaces()), look = sceneLook(s);
      const title = !p.on ? "Scene off" : p.plate ? "Clean plate" + (p.label ? " · " + p.label : "") : p.label || (p.extra ? "Frame's own place, adjusted" : "No scene yet");
      const txt = [p.bg, p.extra, p.light].filter(Boolean).join(" ");
      face.innerHTML = `<span class="kpsc-art">${sceneSVG(s, { ...look, on: p.on, plate: p.plate, aria: title })}</span><span class="kpn-text"><span class="kpn-title">${esc(title)}</span>
        <span class="kpn-snip">${esc(!p.on ? "Frames keep their own setting." : txt || "Pick a location or a place. Frames keep their own setting until you do.")}</span></span>`;
    };
    const open = () => {
      // Show the scene on the frame of a prompt node this scene feeds, when there is one.
      const out = node.outputs?.[0]?.links || [];
      const target = out.map(id => app.graph.links?.[id] || app.graph.links?.get?.(id)).filter(Boolean).map(l => app.graph.getNodeById(l.target_id)).find(n => n && n.type === NODE_TYPE);
      const fw = target?.widgets?.find(w => w.name === "frame");
      openSceneBuilder({
        data, scenes, state: sceneState(node), sample: fw ? frameOf(fw.value) : null,
        onChange: st => {
          sw.value = JSON.stringify(st); sw.callback?.(sw.value);
          loadPlaces().then(l => { if (l) myPlaces = l; draw(); });
          draw(); node.setDirtyCanvas?.(true, true);
          for (const n of app.graph._nodes || []) if (n.type === NODE_TYPE) n._kpsDraw?.();
        },
      });
    };
    wrap.addEventListener("click", e => { if (e.target.closest(".kpsc-face, .kpn-browse")) open(); });
    wrap.addEventListener("pointerdown", e => e.stopPropagation());
    const dom = node.addDOMWidget("scene_card", "kps_scene_card", wrap, { serialize: false, hideOnZoom: false });
    dom.computeSize = () => [0, 150];
    sw.hidden = true; sw.computeSize = () => [0, -4];
    node._kpsDraw = draw;
    draw();
    node.setSize([Math.max(node.size[0], 320), node.computeSize()[1]]);
    return r;
  };
  const onConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () { const r = onConfigure?.apply(this, arguments); this._kpsDraw?.(); return r; };
}

// The Call Sheet Camera node: the camera's drawing and a button that opens the camera picker.
function addCameraCard(nodeType) {
  const onNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    const r = onNodeCreated?.apply(this, arguments);
    const node = this;
    const cw = node.widgets?.find(w => w.name === "camera");
    if (!cw || !node.addDOMWidget || !cams) return r;
    const wrap = document.createElement("div");
    wrap.className = "kps kpn kpc";
    wrap.innerHTML = `<button type="button" class="kpn-face kpc-face" title="Open the camera picker"></button>
      <div class="kpn-bar"><button type="button" class="kps-btn kps-accent kpn-browse">Camera and look</button></div>`;
    const face = wrap.querySelector(".kpc-face");
    const draw = () => {
      const s = cameraState(node), p = cameraParts(cams, s);
      const name = cameraLabel(p), lk = p.look && cams.looks ? cams.looks.find(l => l.value === p.look) : null;
      const title = !p.on ? "Camera off" : name ? name + (p.skin && (p.cam || p.look) ? " + real skin" : "") : "Frame's own camera";
      const snip = !p.on ? "Frames keep their own camera and finish." : cameraText(p) || "Pick a camera or a look: phone, flash, film, a grade, a light or an art style.";
      const live = p.on && (p.cam || p.look || p.skin);
      face.innerHTML = `<span class="kpc-art${live ? "" : " is-off"}"${lk && lk.swatch && !p.cam ? ` style="background:${esc(lk.swatch)}"` : ""}>${lk && !p.cam ? "" : cameraIcon(p.cam, 36)}</span><span class="kpn-text"><span class="kpn-title">${esc(title)}</span>
        <span class="kpn-snip">${esc(snip)}</span></span>`;
    };
    const open = () => {
      const out = node.outputs?.[0]?.links || [];
      const target = out.map(id => app.graph.links?.[id] || app.graph.links?.get?.(id)).filter(Boolean).map(l => app.graph.getNodeById(l.target_id)).find(n => n && n.type === NODE_TYPE);
      const fw = target?.widgets?.find(w => w.name === "frame");
      openCameraPicker({
        data, cams, state: cameraState(node), sample: fw ? frameOf(fw.value) : null,
        onChange: st => {
          cw.value = JSON.stringify(st); cw.callback?.(cw.value);
          draw(); node.setDirtyCanvas?.(true, true);
          for (const n of app.graph._nodes || []) if (n.type === NODE_TYPE) n._kpsDraw?.();
        },
      });
    };
    wrap.addEventListener("click", e => { if (e.target.closest(".kpc-face, .kpn-browse")) open(); });
    wrap.addEventListener("pointerdown", e => e.stopPropagation());
    const dom = node.addDOMWidget("camera_card", "kps_camera_card", wrap, { serialize: false, hideOnZoom: false });
    dom.computeSize = () => [0, 120];
    cw.hidden = true; cw.computeSize = () => [0, -4];
    node._kpsDraw = draw;
    draw();
    node.setSize([Math.max(node.size[0], 320), node.computeSize()[1]]);
    return r;
  };
  const onConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () { const r = onConfigure?.apply(this, arguments); this._kpsDraw?.(); return r; };
}

// The Call Sheet Outfit node: the figure in the outfit and a button that opens the outfit builder.
function addOutfitCard(nodeType) {
  const onNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    const r = onNodeCreated?.apply(this, arguments);
    const node = this;
    const ow = node.widgets?.find(w => w.name === "outfit");
    if (!ow || !node.addDOMWidget || !outfits) return r;
    const wrap = document.createElement("div");
    wrap.className = "kps kpn kpo";
    wrap.innerHTML = `<button type="button" class="kpn-face kpo-face" title="Open the outfit builder"></button>
      <div class="kpn-bar"><button type="button" class="kps-btn kps-accent kpn-browse">Build outfit</button></div>`;
    const face = wrap.querySelector(".kpo-face");
    const draw = () => {
      const s = outfitState(node), p = outfitParts(outfits, s, myItems), txt = outfitText(p);
      const title = !p.on ? "Outfit off" : !p.pieces.length ? "No outfit yet" : p.swap === "pick" ? "Just what I pick" : "Whole outfit";
      face.innerHTML = `<span class="kpo-art">${outfitSVG(outfits, s, myItems, { on: p.on, size: 60, aria: title })}</span><span class="kpn-text"><span class="kpn-title">${esc(title)}</span>
        <span class="kpn-snip">${esc(!p.on ? "Frames keep their own clothes." : txt || "Pick a top and bottoms or a one piece. Frames keep their own clothes until you do.")}</span></span>`;
    };
    const open = () => {
      const out = node.outputs?.[0]?.links || [];
      const target = out.map(id => app.graph.links?.[id] || app.graph.links?.get?.(id)).filter(Boolean).map(l => app.graph.getNodeById(l.target_id)).find(n => n && n.type === NODE_TYPE);
      const fw = target?.widgets?.find(w => w.name === "frame");
      openOutfitBuilder({
        data, outfits, state: outfitState(node), sample: fw ? frameOf(fw.value) : null,
        onChange: st => {
          ow.value = JSON.stringify(st); ow.callback?.(ow.value);
          loadItems().then(l => { if (l) myItems = l; draw(); for (const n of app.graph._nodes || []) if (n.type === NODE_TYPE) n._kpsDraw?.(); });
          draw(); node.setDirtyCanvas?.(true, true);
          for (const n of app.graph._nodes || []) if (n.type === NODE_TYPE) n._kpsDraw?.();
        },
      });
    };
    wrap.addEventListener("click", e => { if (e.target.closest(".kpo-face, .kpn-browse")) open(); });
    wrap.addEventListener("pointerdown", e => e.stopPropagation());
    const dom = node.addDOMWidget("outfit_card", "kps_outfit_card", wrap, { serialize: false, hideOnZoom: false });
    dom.computeSize = () => [0, 130];
    ow.hidden = true; ow.computeSize = () => [0, -4];
    node._kpsDraw = draw;
    draw();
    node.setSize([Math.max(node.size[0], 320), node.computeSize()[1]]);
    return r;
  };
  const onConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () { const r = onConfigure?.apply(this, arguments); this._kpsDraw?.(); return r; };
}

app.registerExtension({
  name: "krea.PoseSheet",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === "KreaPosePerson") { addPersonCard(nodeType); return; }
    if (nodeData.name === SCENE_TYPE) { addSceneCard(nodeType); return; }
    if (nodeData.name === OUTFIT_TYPE) { addOutfitCard(nodeType); return; }
    if (nodeData.name === CAMERA_TYPE) { addCameraCard(nodeType); return; }
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
      const sceneLine = f => {
        const sc = scenes && nodeCtx(node).scene();
        if (!sc) return "";
        const lock = sceneLocked(scenes, f, nodeOverrides(node));
        const what = sc.parts.plate ? "Clean plate" : "Scene";
        if (sc.parts.plate) return `<span class="kpn-scene" title="Clean plate from your Scene node: the shot with nobody in it">Clean plate${sc.label && !lock ? ": " + esc(sc.label) : ""}</span>`;
        return lock ? `<span class="kpn-scene is-locked" title="This pose needs its own location, so the Scene node is skipped">Setting: frame's own</span>`
          : `<span class="kpn-scene" title="The frame's setting is replaced by your Scene node">Setting: Scene node${sc.label ? " (" + esc(sc.label) + ")" : ""}</span>`;
      };
      const outfitLine = f => {
        const o = outfits && nodeCtx(node).outfit();
        if (!o) return "";
        const lock = outfitLocked(outfits, f, outfitOverrides(node));
        return lock ? `<span class="kpn-outfit is-locked" title="This pose relies on its own clothes, so the Outfit node is skipped">Clothes: frame's own</span>`
          : `<span class="kpn-outfit" title="The frame's own clothes are replaced by your Outfit node">Clothes: Outfit node (${esc(o.label)})</span>`;
      };
      const cameraLine = () => {
        const c = cams && nodeCtx(node).camera();
        return c ? `<span class="kpn-camera" title="Your Camera node sets how every frame was shot">Camera: ${esc(c.label)}</span>` : "";
      };
      const draw = () => {
        const f = frameOf(fw.value);
        const ed = f && nodeEdits(node)[f.id];
        // The card shows the prompt as the node outputs it, with a linked outfit and scene already applied.
        let shown = f && (ed ? { ...f, text: ed } : f);
        if (f) {
          const ctx = nodeCtx(node), o = outfits && ctx.outfit(), sc = scenes && ctx.scene();
          if (o) { const [t, ch] = withOutfit(outfits, shown, o.parts, outfitOverrides(node)); if (ch) shown = { ...shown, text: t }; }
          if (sc && !sc.parts.plate) { const [t, ch] = withScene(scenes, shown, sc.parts, nodeOverrides(node)); if (ch) shown = { ...shown, text: t }; }
        }
        face.innerHTML = f ? `${thumbHTML(f, thumbs)}<span class="kpn-text"><span class="kpn-title"><span class="kps-no">${frameNo(f.id)}</span> ${esc(f.title)}${ed ? ' <span class="kps-badge kps-upd">Edited</span>' : ""}</span>
          <span class="kpg-set">${esc(data.tabs.find(t => t.id === f.tab)?.name || "")} · ${esc(data.sets[f.set] || "")}</span><span class="kpn-snip">${esc(snippet(shown))}</span><span class="kpn-tags">${sceneLine(f)}${outfitLine(f)}${cameraLine()}</span></span>`
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
      dom.computeSize = () => [0, 188];

      // The dropdown stays (hidden) so saved workflows and the API keep working.
      fw.hidden = true;
      fw.computeSize = () => [0, -4];
      for (const name of ["edits", "scene_overrides", "outfit_overrides"]) {
        const hw = node.widgets.find(w => w.name === name);
        if (hw) { hw.hidden = true; hw.computeSize = () => [0, -4]; }
      }
      const occ = node.onConnectionsChange;
      node.onConnectionsChange = function () { const o = occ?.apply(this, arguments); setTimeout(draw, 0); return o; };
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
      data, scenes, thumbs, ctx: localCtx(), setPreview: setPreviewFromLastRender, openPerson: personOpener,
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
          { label: "To node", title: "Add a Call Sheet Shot node set to this frame, or update the selected one", run: (f, _p, btn) => sendToPoseNode(app, f, "single frame", sheet.state(), btn) },
          { label: "To text box", title: "Put this prompt in the selected CLIP Text Encode (or any node with a text box)", run: (_f, p, btn) => sendToText(app, p, btn) },
        ],
        setActions: [
          { label: "Set to node", title: "Add a Call Sheet Shot node that outputs this whole set as a list", run: (_s, frames, _p, btn) => frames.length && sendToPoseNode(app, frames[0], "whole set", sheet.state(), btn) },
        ],
      });
    };
    const reg = { id: "krea-pose-sheet", icon: "pi pi-images", title: "Call Sheet", tooltip: "Call Sheet", type: "custom", render };
    if (app.extensionManager?.registerSidebarTab) app.extensionManager.registerSidebarTab(reg);
    else console.warn("[Call Sheet] This ComfyUI frontend has no sidebar API; update ComfyUI to see the Call Sheet panel. The nodes still work.");
  },
});
