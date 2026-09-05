# fuch.ai — reverse-engineering notes

Reference read of https://www.fuch.ai (Sayandeep Bose), captured 2026-09-05 at 1454×744.
Source pulled from the live Vite build (`assets/index-DQxtfiq3.css`, 32 KB + lazy chunks);
measurements are computed styles off the live DOM, not guesses.

Our site already credits fuch.ai on `/colophon`. This file records *what* to learn from it.

---

## 1. The architectural difference that causes most of our bugs

**They never scroll the page. We do.**

    html, body { overflow: hidden; height: 100% }

On every route: `innerHeight 744`, `body.scrollHeight 744`. The page is a fixed 100vh stage.
Density is absorbed by **one inner column that scrolls under a gradient mask**:

    .no-scrollbar {
      overflow-y: auto;
      -ms-overflow-style: none;  scrollbar-width: none;
      mask-image: linear-gradient(#000 calc(100% - 80px), transparent);
      padding-right: 18px;   /* room where the scrollbar would be */
      padding-bottom: 26px;
    }
    .no-scrollbar::-webkit-scrollbar { display: none }

Measured: Work's card column is a 538×494 window onto 1408px of content (2.8× overflow).
Contact's left column is 378×225 onto 421px.

Only below 768px do they release it:

    @media (max-width: 768px) {
      html, body { overflow-y: auto; overflow-x: hidden }
      .app-container { height: auto !important; min-height: 100vh }
    }

**Why this matters to us:** our fixed overlays (ticker, now-playing, utility icons, brand block)
are positioned against the viewport while content scrolls *past* them. Every collision bug we
have is that mismatch. They removed the mismatch instead of patching the collisions.

## 2. Token system

55 tokens on `:root` vs our 15. The ones we don't have:

    /* type scale */
    --text-micro:10px  --text-small:11px  --text-label:11px  --text-body:14px
    --text-lg:16px     --text-xl:24px     --text-title:22px
    --text-display: clamp(30px, 3.6vw, 56px)
    --text-hero:    clamp(48px, 7vw, 96px)

    /* tracking scale */
    --track-ui:.18em  --track-wide:.42em  --track-body:.02em  --track-display:-.022em

    /* radius scale */
    --radius-chip:4px --radius-control:8px --radius-card:14px
    --radius-modal:20px --radius-pill:999px

    /* layout */
    --gutter:24px  --dock-h:98px

    /* four accents, swapped by context */
    --accent-calm:#0C7E70  --accent-focus:#0E7E8E
    --accent-warm:#0B8676  --accent-alert:#C83F37
    --accent: var(--accent-calm)
    --accent-glow:  color-mix(in srgb, var(--accent) 60%, transparent)
    --accent-mid:   color-mix(in srgb, var(--accent) 35%, transparent)
    --accent-faint: color-mix(in srgb, var(--accent) 12%, transparent)

### The accent is animatable

    @property --accent { syntax: "<color>"; inherits: true; initial-value: #0C7E70 }
    :root { transition: --accent 1.2s cubic-bezier(.43,.13,.23,.96) }

Registering the property with `@property` lets a CSS variable *interpolate*. The whole site's
accent cross-fades over 1.2s when the section changes. Plain `--accent` would snap.

### Scale discipline, measured

| | fuch.ai | ours |
|---|---|---|
| distinct font-size values | 10 | **20** (incl. 8.5 / 9.5 / 10.5 / 12.5 / 13.5 / 14.5px) |
| distinct border-radius values | 3 raw + 5 tokens (12 of 22 uses tokenised) | **13**, none tokenised |
| distinct letter-spacing values | 4 tokens | **9**, none tokenised |
| layout breakpoints | 2 (920, 768) | 2 (1180, 1100) |

The half-pixel font sizes on our side are the tell: those are values nudged by hand to make
something fit, not steps chosen from a scale.

**Honest caveat:** they declare `--z-bg/orb/content/hud/nav/transition/overlay/boot/cursor`
(0/5/10/100/110/200/300/400/500) and then **never use them** — 23 raw z-indexes in the bundle,
including 8500, 9998, 9999 and 999990. Their z-scale is aspirational. Don't copy that part;
copy the *idea* and actually use it.

## 3. Surface treatment — why theirs reads expensive

    .liquid-glass {
      background: linear-gradient(135deg,#ffffff8c,#ffffff4d 46%,#ffffff75);
      backdrop-filter: blur(42px) saturate(190%) brightness(1.05);
      border: 1px solid rgba(255,255,255,.65);
      box-shadow:
        inset 0 1px  1px  #fffffff2,   /* top inner highlight — the "lit" edge */
        inset 0 -8px 20px #ffffff38,   /* bottom inner glow */
        0 18px 44px #283c5a24,         /* wide ambient */
        0 3px  10px #283c5a12;         /* tight contact */
      border-radius: var(--radius-card);
      isolation: isolate;
    }

Four shadow layers (2 inset + 2 drop). A *directional* 135° gradient, not flat white.
`saturate(190%) brightness(1.05)` on the backdrop so colour behind the glass intensifies.

Ours: every card is a **single** drop shadow, a flat `rgba(255,255,255,.72)` fill, and
**zero** `saturate()` in any of our 10 `backdrop-filter` declarations.

Composition is layered: `class="liquid-glass liquid-glass--noisy work-card"` —
base surface + texture modifier + component. We rewrite the glass recipe per component.

## 4. Ambient motion — 27 keyframes vs our 7

Always-on background layers we have no equivalent of:

- `.crt-grain` — **live at 7% opacity**, `mix-blend-mode: overlay`, a 50×50 base64 PNG tiled,
  `animation: grain-shift .6s steps(3) infinite` translating ±2%. This is the single biggest
  reason their flat colour field doesn't look flat.
- `.light-blob--a…d` — four 36–65vmax radial gradients, `filter: blur(80px)`,
  `mix-blend-mode: screen`, drifting on 32s/40s/46s/36s cycles at ±14vw.
- `.breathing-vignette` — radial edge darkening, opacity .46↔.6 over 12s.
- `.scanlines` — 3px repeating gradient at 12%, `mix-blend-mode: multiply`.
- `.cinematic-bg` — video, 60s slow zoom to 1.06.
- `.orb-aura-breathe` — 18s scale 1→1.04→.98 with the blur radius animating too.

Several are `display:none` by default and toggled per theme; `crt-grain` and the blobs were
live on the light theme we measured.

### Performance discipline we lack

    body.view-away    .cinematic-bg, .light-blob, .bg-drift, .crt-grain, … { animation-play-state: paused }
    body.bg-occluded  .light-blob-stage { display:none }

They pause every ambient animation when the tab is hidden, and drop background layers when
something opaque covers them. (`view-away` is what fired during my automation — it's also why
a backgrounded tab froze their animations mid-arc.)

## 5. Page composition

Shared shell on every route:

- Brand block top-left at the 24px gutter: name 21px semibold + mono role line at `--track-ui`.
- Nav: a single `liquid-glass` pill, top-right, ~496×46, with the active item as an inset chip.
- Section header row: `NN / NAME` in accent mono in a ~135px left gutter, intro paragraph in
  column two — **573px wide, 16px/1.45, font-weight 300**. Ours is 560px at 17px/1.55 at
  weight 400; we never use 300 anywhere.
- Column header rows: label left, **count right** (`CAREER … 06`, `SELECTED WORK … 08`,
  `BY THE NUMBERS … 03`), thin rule under.
- Bottom ticker + utility icons + ⌘K search chip.

**Work** — two columns: career timeline (dots + connecting rule, filled accent dot = current)
and work cards. Card = 168px art / 332px text grid; number + category top-left, metric
top-right in accent (`12M+`, `300+`), title, 2-line clamped body, tag chips.

**About** — left half is 11 `.award-draggable` medallions (84–92px, absolute, rotated,
overlapping each other and running off the bottom edge). Right half: `fuch.ai` wordmark ~48px,
accent mono role line, 3-line bio, `BY THE NUMBERS … 03`, three stat cards, MANIFESTO panel.
Vertical "Honors" pull-tab on the right edge.

The medallions are a **sticker-peel** component (ReactBits `StickerPeel`, GSAP Draggable in a
lazy chunk). On hover the sticker physically peels: `clip-path` retracts 30% while a mirrored
`.flap` unfolds above it, with SVG filters `url(#dropShadow)`, `url(#pointLight)` and
`url(#expandAndFill)` doing real lighting. That's the showpiece interaction on the page.

**Contact** — 378px left column (FIND ME links, identity card with a live GST clock and an
"Open to freelance" status pill) and a 400px right column (Message Fuch, three intent cards).
**The middle is deliberately empty** — that's where the 3D orb sits.

## 6. Stack

Vite + React, three.js (Draco-compressed models), zustand, GSAP in lazy route chunks.
**No framer-motion, no Tailwind, no styled-components** — motion is CSS keyframes and rAF.
Routes are code-split; `/about`'s sticker chunk only loads when you go there.
Fonts: Inter (sans + display + wordmark) and JetBrains Mono. Page transitions run 15–20s
end to end, staged: outgoing content blurs and desaturates, intro line rises first, content follows.

---

## What was changed here

Done, and verified in-browser at 1454x788:

1. **Page locked to 100dvh, dense columns get internal masked scroll.** Retired the whole
   class of fixed-overlay collisions instead of patching each. Measured before -> after:
   Work 1659px -> 788, Contact 1077 -> 788, About 858 -> 788, Home already 788.
   Work's project column is now a 408px window onto 1307px; Contact's left column 471
   onto 763; About's card body 356 onto 467.
2. **Token layer added** — type, tracking, radius, spacing, and a *named* layer order.
   All 13 ad-hoc z-indexes now resolve through `--z-figure` … `--z-modal` at their existing
   values, so nothing moved but the next overlay has somewhere to go.
   (Font sizes and radii are tokenised where touched; the long tail is still ad-hoc.)
3. **Glass recipe declared once** as `--glass-fill` / `--glass-edge` / `--glass-blur` /
   `--glass-shadow` and applied to `.panel`, `.project`, `.about-card`, `.nowplaying`.
   Every card went from one drop shadow to four layers, and gained `saturate(180%)`.
4. **Grain upgraded, not added** — the correction to my own note above: `body::after`
   already carried a static SVG-turbulence layer at 3.5%. It now runs `mix-blend-mode:
   overlay` at 5% with a `0.7s steps(3)` drift, and is disabled under reduced motion.
5. **Lead paragraph to weight 300.** Space Grotesk is variable across 300-700, so this
   costs nothing.
6. **Ambient animation pauses in a background tab** via `body[data-away]`, set from
   `page.tsx` on `visibilitychange` — the grain, ticker and badge float all stop.

Deliberately **not** done: registering `--accent` with `@property`. It only pays off if the
accent actually changes per section, which ours does not. Adding the machinery with nothing
driving it would repeat the exact mistake this document flags in their z-index scale.

## Closing the feel gap

A second pass, after the structural work above.

**Staged transitions** (`src/lib/motion.ts`). The section change was one 0.55s crossfade of
the whole block, so everything arrived at once and read as a dissolve. Now: the outgoing
section blurs to 10px *and desaturates to 0.3* over 0.75s — the desaturation is what makes it
read as leaving rather than fading — while the intro line lands alone at 0.05s and the body
follows from 0.42s with a 0.07s stagger. One clock in one file; the four sections import it
rather than each carrying its own delays, which is how they drifted apart before.

**Medallions** (`src/components/medallions.tsx`). The five flat text pills on About are now
seals: a lit face, a dashed inner ring, a resting tilt, real weight in the shadow — and they
can be picked up and thrown around the column. The drag writes straight to the element's
custom properties rather than through state, so a pointermove never re-renders the list or
steals frames from the WebGL figure behind it. Not a copy of the reference's award stickers:
theirs are award images, ours are proof points, so these are struck as coins instead.

**Project glyphs** (`src/components/project-glyph.tsx`). Every work card now has a 152px
plate carrying a drawn diagram of what the project actually does — a node graph for agent
orchestration, stacked sheets for document extraction, converging rays for retrieval, a
two-column rewrite for the transpiler, detection boxes for vision — each in its own hue. The
reference's isometric illustrations are the reason their Work column reads as a portfolio;
six commissioned illustrations were not on the table, so these are procedural instead.

**Career rail.** A vertical rail with a station per role, the current one filled in the
section accent.

**Section accent.** `@property --accent` is now registered, so the custom property actually
interpolates, and each section shifts it a few degrees within the same teal family
(work #2f7286, about #3d7a5f, contact #2d8579) with a 1.2s cross-fade. This is the item
deliberately skipped in the first pass — it earns its place now that something drives it.

**Ambient drift.** `body::before` was a static vignette; it now carries three gradients, one
of them derived from the live accent, drifting on a 48s cycle. Paused with everything else
when the tab is in the background.

### A bug this pass introduced and fixed

Giving the project cards an art plate turned `.project` into a grid, and the cards
immediately clamped to 51px with their titles and blurbs cropped. Cause was one level up:
`.project-list` was a grid, and its six implicit `auto` rows were being sized against the
scroller's definite height rather than their content — so the available 408px was divided
six ways. A flex column sizes children to content and overflows, which is what a scroll
region needs. `.contact-col` had the same shape and was changed with it.

### Two bugs found while verifying

- `/colophon` and `/privacy` could not be scrolled by mouse wheel **at all** — pre-existing,
  confirmed by testing against the original stylesheet before touching it. Cause was
  `html, body { height: 100% }`: the html box was capped at the viewport, and since body
  carries `overflow-x: hidden` (which computes `overflow-y` to `auto`) the wheel had no
  reachable scroll container. Now `min-height: 100%`.
- The overflow lock has to be scoped (`html:has(.stage)`), or those same document routes get
  trapped by it. Caught by checking them; they are not part of the app shell.

---

## How their 3D is actually made

Read from `/assets/Bj_q5hpB.js` and `index-DJeABWj6.js`.

### There are two 3D things, not one

**Homepage "orb"** — a character with moods (`idle`, `excited`, `isWaving`, plus an
`idleVariant`), driven by `orbRef`. Visually a soft dark blob, not a figure.

**Ideas52** — a whole separate 3D world, code-split into its own chunk:
`/models/mascot-anim.glb` (Draco-compressed, **baked animation clips**) walking through a
procedural grass field built on compute shaders (`GrassUpdate` / `GrassReset`, LOD buffers),
under `potsdamer_platz_1k_nb.hdr` with a `starmap_2020_4k.ktx2` sky.

Character controller, for reference:

    walkSpeed 3.2   runSpeed 7   accel 12   decel 18
    rampTime 0.9    turnRate 8   animBlendLerp 0.16

The grass reads `uCharacterWorldPos` every frame, which is how it reacts to the mascot.

**Their character is an asset. Ours is not** — ours is assembled in code from primitives and
posed by a spring rig, which is a harder thing to build and the reason the colophon can claim
it. Swapping to a GLB would be a downgrade, not a copy of something better.

### Their material trick

The mascot's look is a runtime re-grade of the model's own texture, in TSL:

    lum    = dot(rgb, vec3(0.299, 0.587, 0.114))
    sat    = (max(rgb) - min(rgb)) / max(rgb)
    chrome = smoothstep(0.42, 0.72, lum) * (1 - smoothstep(0.16, 0.4, sat))
    dark   = (1 - smoothstep(0.05, 0.4, lum)) * (1 - chrome)

    colorNode     -> mix toward vec3(0.35,0.39,0.45) by chrome
                     mix toward vec3(0.005,0.008,0.013) by dark
    roughnessNode -> 0.52 base, 0.34 where chrome, 0.24 where dark
    emissiveNode  -> color * smoothstep(0.3, 0.55, sat) * 2.9

Bright-and-desaturated becomes chrome; dark stays near-black and glossier; **saturated regions
of the texture become emissive**, which is where the glowing accents come from. Base material
is `metalness 0.72 / roughness 0.52 / envMapIntensity 0.6`.

Worth understanding, not worth copying here: it exists to impose a look on a textured model
somebody else authored. We assign materials per part already, which is strictly more control.

### Their render pipeline — this part is worth copying, and now is

    <Canvas camera={{ position: [0,0,6.2], fov: 40 }}
            gl={{ alpha: true, antialias: true, toneMappingExposure: 0.66,
                  powerPreference: "high-performance" }}>
      <ambientLight intensity={0.02} />
      <directionalLight position={[-4,6,6]} intensity={0.9} castShadow />
      <Environment files="/env/studio_fuch.hdr" resolution={512} />
      <EffectComposer>
        <ToneMapping mode={AGX} />
        <Noise premultiply blendFunction={OVERLAY} opacity={0.1} />
      </EffectComposer>
    </Canvas>

Two things carry most of the quality: **AgX tone mapping** (holds hue through the highlight
shoulder instead of pushing bright saturated pixels to white the way ACES does) and
**ambient at 0.02** — nearly all light comes from the HDRI, because reflections of a real
environment are what make chrome read as metal rather than grey paint.

### The "gif" is an AI-generated video

    /cinematic/kling_20260522_VIDEO_Slow_cinem_5778_0.mp4

Generated with Kling (the filename is the export name), played as a fullscreen
`<video autoplay muted loop playsinline>` behind everything, graded in CSS with
`filter: brightness(.7) saturate(130%) hue-rotate(195deg) contrast(1.05)` and a 60s zoom to
1.06. `display: none` by default and toggled per theme. There is no GIF anywhere on the site.

## What was applied here

- **AgX tone mapping** in the composer, with the renderer's own curve switched off so it is
  not applied twice. Order is bloom (on the linear HDR buffer) -> tone map -> grain, so the
  grain lands in display space rather than being crushed by the curve.
- **Noise pass**, `premultiply` + `OVERLAY` at 0.1, matching theirs.
- **Relit toward the HDRI**: ambient 0.62 -> 0.16, the two fill lights and both point lights
  pulled back, key up slightly, `environmentIntensity` 1.25. The old balance existed to stop
  the previous tone curve clipping the chrome to flat white; AgX rolls those highlights off
  on its own, so the fill could come out and the environment could do the work.

Not applied: their GLB, HDRI, award SVGs and cinematic video are their assets. The texture
re-grade shader solves a problem we do not have. AdaptiveDpr was skipped — it is a
performance tweak, and dynamic DPR changes show as visible resolution popping.
