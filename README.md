# Krea Pose Sheet for ComfyUI

Krea 2 pose prompts, sorted by shoot, right inside ComfyUI.

- **Frame picker.** Click the frame card on the Krea Pose Prompt node (or **Open the pose gallery** in the sidebar) to browse every frame. Search, pick a tab, or use **Filter** for set, camera (overhead, close-up, low angle…) and light (flash, window light, overcast…). Click a card to select it: its prompt loads into an editable box on the right, with a preview of exactly what the node will receive, then press **Use this frame**. **‹ ›** on the node step through frames one at a time.
- **Preview images.** Render a frame, then press **Use last generation as preview** in the picker. That image shows on the frame's card and on the node from then on. Previews stay on your computer in the `thumbs` folder.
- **Edit prompt.** Type straight into the prompt box in the picker, or use **Edit prompt** on the node or **Edit** in the sidebar. Your version is used everywhere you pick that frame and saved inside the workflow, and **Reset** brings back the original.
- **Trigger and person.** The picker's header shows your trigger (click it to change it) and the person in your prompts, with a switch to turn them off. **Edit** opens the person builder: pick a category on the left, choose an option, and a neutral figure on the right updates as you go.
- **Your own prompts.** Press **New prompt** in the picker to write your own and save it to the **Custom** tab. Name it, write it with [trigger] where your trigger or person should go, and it works in the node like any other frame. Custom prompts are saved on your computer in `custom_prompts.json` in the plugin folder, never uploaded, and kept when you update.
- **Export and import.** In the Custom tab, **Export** saves your prompts as a file and **Import** adds the prompts from a file to your list. Importing always adds; it never replaces or removes anything, so delete any duplicates with the **×** on a card.
- **Duplicate to Custom.** Copy any sheet frame into your Custom tab as a starting point for your own version.
- **Starred, Recent and Random.** Star frames to keep them in Starred, find the frames you used lately in Recent, or press **Random** for a surprise pick from what's shown.
- **Keyboard.** Arrow keys move through frames, Enter uses the selected frame, Esc closes the picker.
- **Saved people.** In the person builder, **Save this person** keeps the current picks under a name you choose (or Person 1, Person 2…). Click a saved person to load them.
- **Pose Sheet sidebar.** Open the **Pose Sheet** tab in ComfyUI's left sidebar. Type your LoRA trigger once and every prompt fills it in. Use **Style** off to strip film, grain and palette words when a LoRA should supply the look, **Build a person** to describe who is in the shot, and ☆ to star favorites.
- **Send to the canvas.** Each frame has **To node** (adds a Krea Pose Prompt node set to that frame, or updates the selected one) and **To text box** (fills the selected CLIP Text Encode). Each set has **Set to node**, which outputs the whole set as a list.
- **Krea Pose Prompt node.** Pick a frame, then choose `single frame`, `whole set` or `whole tab`. Outputs `prompt` (one prompt, or all of them one per line), `prompt_list` (a list, so the graph runs once per prompt) and `count`.
- **Krea Pose Scene node.** Build a setting once and use it with any pose. Link its `scene` output to the Pose Prompt node's `scene` input and press **Build scene**. Pick a location, time of day, weather, lighting, era and mood, or choose one of the **Places**. The frame's own setting (and its light line, if you picked lighting) is swapped for yours; the pose, clothes, camera and finish stay. The node's `text` output is the scene on its own.
- **Your own places.** In **Places**, press **New place** and give it a name, a setting and an optional light line. **Help me write it** offers starter ideas and asks what's behind, what's underfoot and one small detail, then writes the setting for you. Places are saved on your computer in `custom_places.json`, never uploaded, with **Import**, **Export** and **×** to delete, like your custom prompts.
- **Clean plate.** Turn on **Clean plate** to get the same shot with nobody in it: the frame's look, camera and light, in your scene, ending with "No people anywhere in the frame."
- **Frames that need their own location.** Some poses rely on something in their setting (a railing, a bed, a car). Those show a lock and keep their own setting, and **Works with scenes** in the picker shows only the frames a scene can move. **Use scene anyway** on a locked frame applies it with a warning. Your own prompts have a **Portable** switch for the same thing. With no scene linked, or **Use this scene** off, every prompt is exactly as before.
- **Saved scenes.** **Save this scene** keeps your picks under a name, with **Import** and **Export** to share them.
- **Krea Pose Person node.** Dropdowns for gender, build, height, hair, eyes, skin and complexion. Link its output to the Pose Prompt node's `person` input.
- **Web version (optional).** The same sheet can be published as a web page on GitHub Pages. See below.

## Install

**ComfyUI Manager:** click **Install via Git URL**, paste `https://github.com/ilikeredheads/comfyui-krea-pose-sheet`, then restart ComfyUI.

**By hand:**

```
cd ComfyUI/custom_nodes
git clone https://github.com/ilikeredheads/comfyui-krea-pose-sheet
```

Restart ComfyUI. There are no extra Python packages to install.

## Settings that work

- Krea 2 Turbo: 8 steps.
- CFG `1.0` on the stock KSampler. Krea's own tools use 0.0, which breaks the image in KSampler.
- Render at full size (trained up to 2048×2048) instead of upscaling.
- Match the canvas to the shot: wide for side views, tall for full length.

## Getting updates

In ComfyUI Manager, click **Update** on Krea Pose Sheet (or `git pull` in its folder), then restart ComfyUI.

## Optional: publish to the Comfy Registry

1. Sign in at [registry.comfy.org](https://registry.comfy.org) with GitHub and create a publisher. Put its id in `pyproject.toml` as `PublisherId`.
2. On the registry, create an API key for that publisher.
3. In this repo on GitHub: Settings → Secrets and variables → Actions → New repository secret, named `REGISTRY_ACCESS_TOKEN`, with the key as its value.
4. From then on, every push to `main` that changes the version in `pyproject.toml` publishes automatically. You can also run **Publish to Comfy Registry** by hand from the Actions tab.

## Optional: web page on GitHub Pages

Settings → Pages → Source: **GitHub Actions**, then run **Publish web sheet to GitHub Pages** from the Actions tab. The sheet appears at `https://ilikeredheads.github.io/comfyui-krea-pose-sheet/`.

## Files

| Path | What it is |
| --- | --- |
| `web/poses.json` | All prompts, sets, person traits and the changelog |
| `web/core.js` | Prompt logic: trigger, Style off, person text |
| `web/sheet.js`, `web/sheet.css` | The sheet interface, shared by the sidebar and the web page |
| `web/gallery.js` | The frame picker and the prompt editor |
| `web/builder.js`, `web/figure.js` | The person builder and its figure |
| `custom.py`, `web/custom.js` | Your own prompts (Custom tab), saved locally |
| `web/pose_sheet.js` | ComfyUI sidebar tab, node frame card and Send buttons |
| `thumbs.py` | Saves and serves your preview images |
| `nodes.py`, `pose_data.py` | The nodes (`pose_data.py` mirrors `core.js`) |
| `web/scenes.json` | Scene options and which frames keep their own location |
| `scene_data.py`, `web/scene_core.js` | Scene logic: swap the setting, clean plate (`scene_data.py` mirrors `scene_core.js`) |
| `web/scene.js`, `web/scene_art.js` | The scene builder and its picture |
| `places.py` | Your own places, saved locally |
| `site/index.html` | The GitHub Pages page |
| `scripts/` | `release.py`, `validate.py`, `build_site.sh`, `sync_from_artifact.mjs` |
