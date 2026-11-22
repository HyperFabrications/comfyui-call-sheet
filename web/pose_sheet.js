// ComfyUI entry point: adds the Pose Sheet sidebar tab and wires its Send buttons to the canvas.
import { mountSheet } from "./sheet.js";
import { loadData, frameKey } from "./core.js";

const HERE = new URL(".", import.meta.url);
const NODE_TYPE = "KreaPosePrompt";

async function getApp() {
  if (window.comfyAPI?.app?.app) return window.comfyAPI.app.app;
  return (await import("../../scripts/app.js")).app;
}

function addStyles() {
  if (document.getElementById("kps-css")) return;
  const link = document.createElement("link");
  link.id = "kps-css"; link.rel = "stylesheet"; link.href = new URL("sheet.css", HERE).href;
  document.head.appendChild(link);
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

function selectedNodes(app) {
  return Object.values(app.canvas?.selected_nodes || {});
}

// Put a Krea Pose Prompt node on the canvas (or reuse the selected one) set to this frame.
function sendToPoseNode(app, frame, mode, state, btn) {
  const LG = window.LiteGraph;
  let node = selectedNodes(app).find(n => n.type === NODE_TYPE);
  const isNew = !node;
  if (!node) {
    node = LG.createNode(NODE_TYPE);
    if (!node) { flash(btn, "Restart ComfyUI"); return; }
    const c = app.canvas;
    const ds = c.ds;
    const cx = (-ds.offset[0]) + (c.canvas.width / ds.scale) / 2 - 160;
    const cy = (-ds.offset[1]) + (c.canvas.height / ds.scale) / 2 - 80;
    node.pos = [cx, cy];
    app.graph.add(node);
    app.canvas.selectNode?.(node);
  }
  setWidget(node, "frame", frameKey(frame));
  setWidget(node, "mode", mode);
  setWidget(node, "trigger", state.trigger);
  setWidget(node, "style", state.style);
  setWidget(node, "person", state.person);
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

const appP = getApp();

appP.then(app => app.registerExtension({
  name: "krea.PoseSheet",
  async setup() {
    addStyles();
    const data = await loadData(new URL("poses.json", HERE).href);
    let sheet = null;
    const render = el => {
      el.innerHTML = "";
      const root = document.createElement("div");
      root.style.cssText = "padding:0 12px;height:100%;overflow-y:auto;" +
        "--kps-bg:var(--comfy-menu-bg,#202020);--kps-paper:var(--comfy-input-bg,#2a2a2a);--kps-ink:var(--input-text,var(--fg-color,#ddd));" +
        "--kps-muted:var(--descrip-text,#999);--kps-line:var(--border-color,#444);--kps-code:var(--comfy-menu-secondary-bg,#1a1a1a);" +
        "--kps-accent:#ef6b5f;--kps-accent-soft:#3a201d;--kps-body:inherit;--kps-display:inherit;";
      el.appendChild(root);
      sheet = mountSheet(root, data, {
        compact: true,
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
}));
