# 3D Animation on Websites — How It Works & How to Not Get Stuck

A practical guide to how sites like fuch.ai build a live, rigged 3D character that idles, waves, bows, and morphs into something else — covering the rendering pipeline, the animation techniques, the tools, and the performance rules that keep it from falling over.

---

## 1. The rendering pipeline, in plain terms

Every 3D-on-the-web setup boils down to the same five ideas, no matter which library you use:

| Term | What it actually is |
|---|---|
| **Scene** | A container/tree holding everything you want drawn — like a DOM tree, but for 3D objects |
| **Camera** | Your virtual eye — a perspective camera (mimics human vision, most common) or an orthographic one (no perspective distortion, used for technical/product views) |
| **Geometry** | The raw shape — a list of vertices (points in 3D space) and how they connect into triangles |
| **Material** | How the surface reacts to light — color, roughness, metalness, textures |
| **Mesh** | Geometry + Material combined = an actual drawable object |

The **renderer** takes the scene + camera, figures out what's visible, and rasterizes it to a `<canvas>` using WebGL (or the newer WebGPU) — this happens every single frame, ideally 60 times a second. A mesh is just a geometry (shape) paired with a material (color/surface response); rendering is the act of drawing that scene through the camera.

**Three.js** is the library almost everyone uses to do this without hand-writing raw WebGL. Raw WebGL only knows how to draw points, lines, and triangles, so anything meaningful takes a lot of boilerplate — Three.js wraps that in a scene graph, lighting model, and material system so you write far less code.

You don't need to touch raw WebGL/GLSL for 90% of what you want to build. You only drop down to that level for custom shader effects (the glitch/dissolve/twist stuff — section 3).

---

## 2. The three ways a 3D object actually "moves"

This is the part people conflate. There are three fundamentally different animation techniques, and a polished character (like the fuch.ai robot) usually combines all three.

### A. Transform animation (the easy 80%)
Just animating position, rotation, or scale of a whole object or group — floating idle bob, a camera dolly, a card sliding in. No mesh deformation at all. This is what GSAP/Framer Motion tweens are built for.

### B. Skeletal (bone/rig) animation — for poses like wave, bow, walk
A skeleton of **bones** sits inside the mesh; each vertex is "weight-painted" to one or more bones so it moves proportionally when a bone rotates. This is how the wave, the thinking pose, and the bow/curl pose on fuch.ai work — a rig with an arm bone, a spine bone, a head bone, animated via keyframes exported from Blender/Maya, then played back in the browser with Three.js's `AnimationMixer`. Three.js's animation system can drive bones, morph targets, material properties, visibility, and transforms all at once, and it supports fading, cross-fading, and blending multiple animations together on the same object at different weights.

Where "twisting" specifically comes in: a **twist bone** (or twist constraint) is a secondary bone inserted along a limb specifically to distribute rotation smoothly — e.g. a forearm twisting near the wrist without corkscrewing the whole arm rigidly. Without it, a rotated hand looks like a candy-cane. This is standard rigging vocabulary from film/game character work, not something unique to web 3D — it gets exported into the glTF/GLB file along with the rest of the skeleton.

### C. Morph target (blend shape) animation — for a robot ↔ human transformation
Instead of bones, you store **multiple full vertex-position sets for the exact same mesh topology** (identical vertex count and order) — a "neutral" version and one or more "target" versions — and blend between them by weight (0 = neutral, 1 = target). This is the standard technique behind facial expressions (a smiling mouth, a closed eye, a raised eyebrow), but in principle the same math can blend between two completely different shapes.

**This is the theoretical mechanism behind a "robot morphs into a person" effect** — but it only works if both meshes share identical topology, which two independently-modeled characters almost never do. In practice, sites doing a robot↔human "morph" fake it with a combination instead:

1. **Two separate meshes**, cross-dissolved with a **noise-driven dissolve shader** (see section 3) rather than a true vertex morph — the outgoing mesh dissolves/glitches away while the incoming one fades in through the same noise mask, so it *reads* as one continuous transformation even though it's really two models overlapping for a few frames.
2. A **glitch post-processing pass** (RGB channel shift, scanline displacement, block noise) laid over the crossfade to hide the seam — this is why an effect like the fuch.ai transition looks "corrupted" rather than a clean dissolve.
3. Separately, the **on-screen numbers/text scrambling** (10+ → 8+, 20M+ → 17M+) isn't a 3D effect at all — it's a simple DOM/canvas text animation that rapidly swaps random digits before landing on the final value, timed to match the length of the 3D transition.

---

## 3. Shaders: what a "twist" or "dissolve" effect actually is under the hood

Every material, at the GPU level, runs two small programs per frame:

- **Vertex shader** — runs once per vertex, decides *where* that point ends up in space. This is where you inflate, twist, bend, or displace geometry.
- **Fragment (pixel) shader** — runs once per visible pixel, decides *what color* it is. This is where dissolve edges, glow, and glitch coloring happen.

### Twist / bend / procedural deformation
A vertex shader can offset every vertex based on its position along an axis — e.g. rotate `x/z` by an angle proportional to `y` to twist a tower, or push vertices outward along their normals using a noise function to make a surface ripple or breathe. Moving vertices along their surface normals is the standard way to build this kind of displacement, and the same technique drives an idle "breathing" bob on a character, cloth/flag movement, and the "inflate before it collapses" beat common in dissolve effects — the mesh puffs up slightly along its normals as the effect passes through, then collapses flat along an axis afterward to sell the disintegration.

### Dissolve / glitch transition
The classic recipe: feed a **noise texture** (Perlin, Voronoi, or a barcode/glitch pattern) into the fragment shader, and clip any pixel whose noise value is below a `threshold` you animate from 0 → 1 over time. Because the clip threshold is a single animated value, more of the mesh becomes visible or invisible as it steps through the noise field, and the exact clip edge can be tinted with an emissive glow color to sell a "materializing" or "dematerializing" look. Different noise textures and glow colors change the character of the effect entirely — soft Perlin-type noise with a warm glow reads as a "magma" burn, while a hard-edged offset/barcode-style pattern with a cyan-green glow reads as the blocky "glitch" look.

You don't have to hand-write GLSL for this from scratch — Three.js's newer **TSL (Three.js Shading Language)** lets you build the same marble/hologram/dissolve/glitch effects in plain JavaScript node graphs instead of raw shader code.

---

## 4. Picking your tools (don't over-engineer this)

| Layer | Options | When to use it |
|---|---|---|
| **Full custom 3D** | Three.js (vanilla) | Full control, most tutorials/examples exist for it, steepest learning curve |
| **3D inside React** | React Three Fiber (r3f) + drei | You're already in React/Next.js — r3f wraps Three.js in JSX components/hooks with no extra runtime overhead versus using Three.js directly, since everything that works in plain Three.js still works underneath it |
| **No-code 3D** | Spline | Design the scene visually, export/embed it. Three.js is the more established, lower-level, more customizable option; Spline trades some control for a much faster design workflow — good for a hero character/scene when you don't need deep custom shader work |
| **VR-flavored / simplest 3D** | A-Frame | HTML-tag-based, easiest entry point for non-3D developers, also a Three.js wrapper under the hood but aimed at quickly building a basic scene, including for VR |
| **Scroll/timeline choreography** | GSAP + ScrollTrigger (+ Lenis for smooth scroll) | Ties any of the above to scroll position — ScrollTrigger connects scroll position to animation state, effectively turning the scrollbar into a timeline controller that can start, scrub, pin, or reverse an animation |

**Rule of thumb**: CSS 3D combined with GSAP gets you roughly 80% of the visual impact at 20% of the complexity for most landing pages. Reach for true WebGL/Three.js specifically when you need particles, custom shaders, or genuinely 3D geometry that CSS transforms can't fake.

---

## 5. A concrete build recipe (this is basically what fuch.ai is doing)

1. **Model + rig the character in Blender** (or use a ready character): one mesh, one skeleton, a few named animation clips (`Idle`, `Wave`, `Think`, `Bow`), plus — if you want a true morph, not a crossfade-fake — a duplicate mesh with identical topology as a second "human" morph target.
2. **Export as `.glb`** with Draco or Meshopt compression on the geometry and KTX2 on the textures — this is the single biggest loading-speed win. Draco-compressed geometry can shrink a multi-megabyte glTF file substantially, at the cost of a small extra decode step on the client device.
3. **Load it once** with `GLTFLoader` plus a shared `DRACOLoader` instance — create one decoder instance and reuse it rather than creating a fresh one per load.
4. **Drive poses with `AnimationMixer`**: cross-fade from `Idle` → `Wave` on hover, `Idle` → `Bow` on the Contact page, using the mixer's built-in fade/crossfade support rather than snapping between clips.
5. **Build the transition state** as its own material/shader pass: noise-driven dissolve + glitch overlay (section 3), timed to run in both directions (a `phase` value going 0→1 for robot→human, 1→0 for the reverse), independent of the skeletal animation underneath.
6. **Sync the DOM**: trigger the number-scramble/heading-swap via the same timeline (a GSAP timeline, or a simple `requestAnimationFrame` counter) so text and mesh transform together instead of drifting at slightly different speeds.
7. **Wire it to scroll/section changes** with ScrollTrigger (or route changes, if each "page" is really a UI state rather than a real navigation) so the character re-poses as the visitor moves between Home/Work/About/Contact.

---

## 6. Performance rules that actually matter

Most "why is my 3D site laggy / why did it crash on mobile" problems come from a short, repeatable list:

- **Compress everything.** Geometry → Draco or Meshopt. Textures → KTX2, which stays GPU-compressed in memory (unlike JPEG/PNG, which must be fully decompressed before the GPU can use it). KTX2 is the better choice when loading time and memory conservation both matter, such as multi-asset scenes; for a single hero model where memory isn't a concern, a plain format like WebP or JPEG can still give a smaller download at the cost of being fully uncompressed once loaded.
- **Reduce draw calls, not just triangle count.** Combining geometries, batching, and instancing all target draw-call count and memory — the actual bottlenecks — rather than how detailed any single mesh looks. Concretely: simplify geometry where possible, merge geometries that share a material to cut draw calls, and instance anything that repeats.
- **Use `InstancedMesh` for repeated objects** (particles, crowds, repeated props) instead of one mesh per copy — this is the standard way to handle hundreds or thousands of similar objects without linear overhead per object.
- **Use `renderer.setAnimationLoop()` instead of a manual `requestAnimationFrame` loop** — it handles WebXR sessions automatically and gives cleaner start/stop control, and is the currently recommended pattern.
- **Skeletal animation is itself a memory optimization** for characters, not just a modeling convenience — storing bone transforms is far cheaper than storing full per-vertex animation data, which is a big part of why the overwhelming majority of real-time 3D characters use skeletal rigs rather than per-frame vertex animation.
- **Lazy-load the 3D bundle.** Don't ship Three.js + your GLB in the main JS bundle — code-split it behind a loading state so the rest of the page (text, nav) is interactive immediately, and show a boot/progress UI (like fuch.ai's "CALIBRATING CHASSIS…" screen) while the model streams in. That loading screen isn't just decoration — it's hiding real, unavoidable download and decode time.
- **Profile before you optimize.** Use the browser's WebGL/GPU profiler or a stats overlay to find the actual bottleneck (draw calls vs. fill-rate vs. JS main-thread) rather than guessing, and don't be afraid to post a minimal reproducible example on the Three.js community forum (discourse.threejs.org) when you're stuck on something specific — it's usually the fastest way to an answer.

---

## 7. Where people (understandably) get stuck

If you're mid-project and stuck, it's almost always one of these:

- **"My rotation looks broken/twisted wrong."** You're rotating a whole mesh/bone instead of using a twist bone or a normal-based vertex offset — a single joint rotation applied along a long limb will always look rigid/candy-caned. Add an intermediate twist bone, or, for a fully procedural surface with no rig, rotate vertices by an amount proportional to their position along the axis, not by one uniform rotation.
- **"My dissolve/morph looks like a hard cut, not a transition."** You're probably swapping `visible = true/false` instead of driving a continuous `threshold`/`phase` uniform through a shader material over time.
- **"Two different characters won't morph into each other."** True vertex morphing requires identical vertex count and order between both meshes — two independently modeled characters almost never satisfy this. Fake it with the crossfade + glitch-overlay technique in section 3 instead of chasing a literal shared-topology morph.
- **"It's smooth on my laptop, terrible on a phone."** You're not compressing textures/geometry, and/or you're using heavy PBR materials everywhere. Check texture formats first (KTX2), then draw calls, before touching shader complexity.
- **"Load time is too long / blank white screen."** No loading state and no compression pipeline. Add Draco/Meshopt + KTX2, and put a visible progress UI in front of the fetch so users don't think the page is broken.
- **"Animations don't blend, they snap."** You're calling `.play()` on a new `AnimationAction` without `.crossFadeTo()`/`.fadeIn()` from the old one — Three.js's mixer supports this natively, you just have to opt into it explicitly.

---

## 8. Quick reference / further reading

- Three.js official docs & manual — threejs.org (fundamentals, animation system, loaders)
- "Three.js Journey" (Bruno Simon) — the most complete paid course covering fundamentals through custom shaders
- r3f.docs.pmnd.rs — React Three Fiber docs, if you're in React/Next.js
- `gltf-transform` CLI — one tool that handles Draco/Meshopt/KTX2 optimization of any `.glb`
- GreenSock (gsap.com) docs on ScrollTrigger — for scroll-driven choreography
- discourse.threejs.org — the community forum, good for getting unstuck on a specific rendering bug

---

### TL;DR
- **Transforms** move things. **Skeletal rigs** pose characters (waves, bows — twist bones fix the candy-cane look). **Morph targets** blend between identical-topology shapes (mostly facial expressions). **Shaders** (vertex = position, fragment = color) create dissolve/glitch/twist surface effects — this is what most "morphing" effects on real sites actually are.
- A robot-to-human "morph" on a real site is almost always two meshes plus a noise-driven dissolve/glitch shader, not a literal single-mesh vertex morph.
- Compression (Draco/Meshopt + KTX2) and draw-call reduction (instancing, batching) solve most real-world performance complaints — reach for those before touching shader complexity.