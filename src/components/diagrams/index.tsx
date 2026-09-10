"use client";

import type { ReactNode } from "react";
import { Schematic, Node, Dot, Edge, Label, Group } from "./schematic";

/**
 * One schematic per capability area and per featured project.
 *
 * Every brief names the element that carries the point of its area — the
 * rollback arrow, the HyDE detour, the schema narrowing, the box-as-prompt
 * handoff. Those are drawn accent; everything else is structure. Where a
 * diagram would only be boxes with arrows the brief says to drop it, which is
 * why there is no diagram key for areas that are already carried by prose.
 */

const D: Record<string, { w: number; h: number; body: ReactNode }> = {
  /* ---------------------------- DELHIVERY ---------------------------- */

  // 01 — the rollback arrow is the point
  workflow: {
    w: 720,
    h: 268,
    body: (
      <>
        <Label x={8} y={14} anchor="start" heading>EXECUTION GRAPH</Label>
        <Node x={8} y={46} w={64} label="Start" />
        <Node x={96} y={46} w={92} label="LLM call" />
        <Dot cx={234} cy={64} r={23} label="IF" />
        <Node x={292} y={14} w={96} label="Tool call" />
        {/* stacked plates: a subgraph per item, run concurrently */}
        <rect x={300} y={100} width={120} height={36} rx="7" className="dgm-node dgm-node--muted" />
        <rect x={296} y={96} width={120} height={36} rx="7" className="dgm-node dgm-node--muted" />
        <Node x={292} y={92} w={120} label="Iterate" sub="subgraph per item" accent />
        <Node x={556} y={46} w={64} label="End" />

        <Edge d="M72 64 H96" />
        <Edge d="M188 64 H211" />
        <Edge d="M257 64 C276 64 276 32 292 32" />
        <Edge d="M257 64 C276 64 276 110 292 110" />
        <Edge d="M388 32 C470 32 470 64 556 64" />
        <Edge d="M412 110 C480 110 480 64 556 64" />
        <Label x={272} y={20} anchor="start">AND / OR</Label>
        <Label x={352} y={152}>concurrent</Label>

        <path d="M8 178 H712" className="dgm-rule" />
        <Label x={8} y={200} anchor="start" heading>VERSIONS — ONE LIVE AT A TIME</Label>

        <Node x={8} y={216} w={96} h={34} label="draft" muted />
        <Node x={140} y={216} w={112} h={34} label="published" />
        <Node x={288} y={216} w={84} h={34} label="live" accent />
        <Node x={408} y={216} w={104} h={34} label="archived" muted />
        <Edge d="M104 233 H140" />
        <Edge d="M252 233 H288" />
        <Edge d="M372 233 H408" />

        {/* the point: revert by promoting a stage, not by redeploying */}
        <Edge d="M196 216 C196 186 330 186 330 214" accent />
        <Label x={264} y={182} accent>ROLLBACK · NO REDEPLOY</Label>
      </>
    ),
  },

  // 02 — the two provider routes, and the bypass that only costs on failure
  gateway: {
    w: 720,
    h: 236,
    body: (
      <>
        <Label x={8} y={14} anchor="start" heading>4 SERVICES</Label>
        <Node x={8} y={30} w={108} h={32} label="service A" muted />
        <Node x={8} y={72} w={108} h={32} label="service B" muted />
        <Node x={8} y={114} w={108} h={32} label="service C" muted />
        <Node x={8} y={156} w={108} h={32} label="service D" muted />

        <Node x={244} y={78} w={148} h={62} label="Bifrost gateway" sub="virtual keys · cost · logs" accent />

        <Edge d="M116 46 C186 46 186 100 244 100" />
        <Edge d="M116 88 C186 88 186 104 244 104" />
        <Edge d="M116 130 C186 130 186 116 244 116" />
        <Edge d="M116 172 C186 172 186 122 244 122" />

        <Node x={512} y={30} w={196} h={34} label="/anthropic" sub="Claude family" />
        <Node x={512} y={96} w={196} h={34} label="/genai" sub="Gemini" />
        <Edge d="M392 98 C452 98 452 47 512 47" />
        <Edge d="M392 118 C452 118 452 113 512 113" />

        {/* dashed alternate path — 2s timeout scoped to the gateway only */}
        <Node x={512} y={168} w={196} h={34} label="direct provider API" muted />
        <Edge d="M318 140 C318 190 400 186 512 185" dashed accent />
        <Label x={330} y={214} anchor="start" accent>FAILOVER · 2s TIMEOUT ON THE GATEWAY PATH ONLY</Label>
      </>
    ),
  },

  // 03 — the hard stop is the point
  cost: {
    w: 720,
    h: 246,
    body: (
      <>
        <Node x={8} y={86} w={104} label="token usage" />
        <Node x={148} y={86} w={122} label="pricing table" sub="per model · cached tier" />
        <Edge d="M112 105 H148" />

        <Node x={318} y={38} w={140} h={38} label="per-trace budget" />
        <Node x={318} y={130} w={140} h={38} label="per-period budget" />
        <Edge d="M270 98 C296 98 296 57 318 57" />
        <Edge d="M270 112 C296 112 296 149 318 149" />

        <Node x={534} y={38} w={174} h={38} label="warn" sub="deduped per agent / period" />
        <Node x={534} y={130} w={174} h={38} label="HARD STOP" sub="downstream execution ends" accent />
        <Edge d="M458 57 H534" />
        <Edge d="M458 149 H534" accent />

        {/* child spend aggregates into the parent trace */}
        <Node x={8} y={186} w={104} h={32} label="child trace" muted />
        <Edge d="M60 186 C60 150 60 132 60 118" accent />
        <Label x={70} y={168} anchor="start" accent>ROLLS UP INTO PARENT</Label>
        <Label x={60} y={78} >parent total</Label>
      </>
    ),
  },

  // 04 — the funnel is the point: evaluation, not logging
  observability: {
    w: 720,
    h: 252,
    body: (
      <>
        <Label x={8} y={14} anchor="start" heading>TRACE TREE</Label>
        <Group x={8} y={28} w={276} h={150} label="PARENT TRACE" />
        <Node x={24} y={56} w={110} h={30} label="plan" muted />
        <Node x={24} y={96} w={110} h={30} label="tool call" muted />
        <Group x={150} y={50} w={120} h={112} label="CHILD AGENT" />
        <Node x={162} y={74} w={96} h={28} label="llm" muted />
        <Node x={162} y={112} w={96} h={28} label="tool" muted />
        <Edge d="M79 86 V96" plain />
        <Edge d="M134 71 H162" />
        <Label x={96} y={172} anchor="start" accent>COST ROLLS UP</Label>

        <path d="M300 20 V232" className="dgm-rule" />
        <Label x={318} y={14} anchor="start" heading>EVERY PRODUCTION RUN</Label>

        <Node x={318} y={28} w={104} h={30} label="all runs" accent />
        {[
          ["passed", 62],
          ["partial", 96],
          ["hung", 130],
          ["in-progress", 164],
          ["not-a-request", 198],
        ].map(([l, y]) => (
          <g key={String(l)}>
            <Node x={470} y={Number(y)} w={130} h={26} label={String(l)} muted />
            <Edge d={`M370 58 C370 ${Number(y)} 420 ${Number(y) + 13} 470 ${Number(y) + 13}`} />
          </g>
        ))}
        <Node x={470} y={28} w={130} h={26} label="failed" accent />
        <Edge d="M422 43 H470" accent />
        <Node x={616} y={22} w={96} h={18} label="access denied" muted />
        <Node x={616} y={44} w={96} h={18} label="not found" muted />
        <Node x={616} y={66} w={96} h={18} label="upstream 5xx" muted />
        <Edge d="M600 41 H616" plain />
        <Edge d="M600 41 C608 41 608 53 616 53" plain />
        <Edge d="M600 41 C608 41 608 75 616 75" plain />
      </>
    ),
  },

  // 05 — the contrast is the whole area
  mcp: {
    w: 720,
    h: 238,
    body: (
      <>
        <Label x={8} y={14} anchor="start" heading>BEFORE — WHOLE CATALOG BOUND</Label>
        <Node x={8} y={30} w={96} h={32} label="question" muted />
        <Group x={140} y={24} w={244} h={78} />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={152 + (i % 6) * 38}
            y={40 + Math.floor(i / 6) * 30}
            width={30}
            height={22}
            rx="4"
            className="dgm-node dgm-node--muted"
          />
        ))}
        <Edge d="M104 46 H140" />
        <Node x={424} y={30} w={128} h={32} label="8 iterations" />
        <Edge d="M384 46 H424" />

        <path d="M8 122 H712" className="dgm-rule" />

        <Label x={8} y={148} anchor="start" heading>AFTER — SOP-ROUTED SUBSET</Label>
        <Node x={8} y={164} w={96} h={32} label="question" muted />
        <Node x={132} y={164} w={110} h={32} label="route to SOP" />
        <Group x={272} y={158} w={112} h={44} />
        {Array.from({ length: 3 }).map((_, i) => (
          <rect key={i} x={284 + i * 34} y={170} width={30} height={22} rx="4" className="dgm-node dgm-node--accent" />
        ))}
        <Edge d="M104 180 H132" />
        <Edge d="M242 180 H272" accent />
        <Node x={424} y={164} w={128} h={32} label="3 iterations" accent />
        <Edge d="M384 180 H424" accent />
        <Label x={488} y={216} accent>8 → 3</Label>
      </>
    ),
  },

  /* --------------------------- INTELIGENAI --------------------------- */

  // 01 — the recovery edge is the point
  agents: {
    w: 720,
    h: 232,
    body: (
      <>
        <Node x={8} y={92} w={104} label="task" muted />
        <Node x={148} y={92} w={104} label="plan" />
        <Node x={288} y={92} w={104} label="call" />
        <Node x={428} y={92} w={112} label="observe" />
        <Node x={576} y={92} w={132} label="answer" />
        <Edge d="M112 111 H148" />
        <Edge d="M252 111 H288" />
        <Edge d="M392 111 H428" />
        <Edge d="M540 111 H576" />

        {/* recover, rather than continue past a failed step */}
        <Edge d="M484 92 C484 44 200 44 200 90" accent />
        <Label x={342} y={38} accent>RECOVER ON FAILED STEP</Label>

        <Group x={264} y={158} w={300} h={62} label="MCP SERVERS — HOSTED SERVICES" />
        <Node x={280} y={180} w={84} h={28} label="fleet" muted />
        <Node x={378} y={180} w={84} h={28} label="plant" muted />
        <Node x={476} y={180} w={72} h={28} label="docs" muted />
        <Edge d="M340 130 V180" dashed />
        <Label x={356} y={152} anchor="start">tools over MCP</Label>
      </>
    ),
  },

  // 02 — fan-out and the correctness valve
  documents: {
    w: 720,
    h: 244,
    body: (
      <>
        <Node x={8} y={92} w={104} label="ingest" />
        <Label x={60} y={78} accent>500K+ DOCS</Label>
        <Node x={144} y={92} w={92} label="queue" />
        <Edge d="M112 111 H144" />

        <Node x={268} y={40} w={92} h={28} label="worker" muted />
        <Node x={268} y={96} w={92} h={28} label="worker" muted />
        <Node x={268} y={152} w={92} h={28} label="worker" muted />
        <Edge d="M236 111 C252 111 252 54 268 54" />
        <Edge d="M236 111 H268" />
        <Edge d="M236 111 C252 111 252 166 268 166" />

        <Node x={396} y={92} w={110} label="classify" sub="99%" />
        <Edge d="M360 54 C378 54 378 100 396 100" />
        <Edge d="M360 110 H396" />
        <Edge d="M360 166 C378 166 378 122 396 122" />

        <Node x={542} y={40} w={166} h={38} label="structured fields" sub="custom NER · 90%" />
        <Edge d="M506 104 C524 104 524 59 542 59" />

        {/* low confidence never gets written through silently */}
        <Node x={542} y={150} w={166} h={38} label="human review" accent />
        <Edge d="M506 118 C524 118 524 169 542 169" accent />
        <Label x={560} y={208} anchor="start" accent>LOW CONFIDENCE</Label>
      </>
    ),
  },

  // 03 — the HyDE detour and the RRF merge
  retrieval: {
    w: 720,
    h: 240,
    body: (
      <>
        <Node x={8} y={96} w={92} label="query" />
        <Node x={140} y={30} w={150} h={38} label="HyDE" sub="draft answer, embed that" accent />
        <Node x={140} y={148} w={150} h={34} label="embed directly" />
        <Edge d="M100 108 C120 108 120 49 140 49" accent />
        <Edge d="M100 118 C120 118 120 165 140 165" />

        <Node x={330} y={54} w={120} h={32} label="dense index" />
        <Node x={330} y={140} w={120} h={32} label="sparse / BM25" />
        <Edge d="M290 49 C310 49 310 70 330 70" accent />
        <Edge d="M290 165 C310 165 310 156 330 156" />
        <Edge d="M290 55 C310 55 310 148 330 152" dashed />

        <Dot cx={512} cy={112} r={30} label="RRF" accent />
        <Edge d="M450 70 C480 70 484 92 484 100" accent />
        <Edge d="M450 156 C480 156 484 132 484 124" accent />

        <Node x={576} y={54} w={132} h={34} label="reranker" sub="cross-encoder" />
        <Node x={576} y={140} w={132} h={34} label="model" />
        <Edge d="M542 100 C560 100 560 71 576 71" />
        <Edge d="M642 88 V140" />
        <Label x={512} y={196} accent>NEITHER RANKING DOMINATES</Label>
      </>
    ),
  },

  // 04 — the narrowing is the point
  nl2query: {
    w: 720,
    h: 226,
    body: (
      <>
        <Node x={8} y={92} w={104} label="question" />
        <Group x={144} y={24} w={148} h={172} label="20+ TABLES" />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x={158 + (i % 2) * 62}
            y={46 + Math.floor(i / 2) * 34}
            width={54}
            height={24}
            rx="4"
            className={i === 2 || i === 5 ? "dgm-node dgm-node--accent" : "dgm-node dgm-node--muted"}
          />
        ))}
        <Edge d="M112 111 H144" />

        <Node x={328} y={94} w={112} h={36} label="selected" sub="subset only" accent />
        <Edge d="M292 111 H328" accent />
        <Node x={472} y={94} w={104} h={36} label="generate" sub="SQL / Mongo" />
        <Edge d="M440 112 H472" />

        <Node x={472} y={24} w={104} h={34} label="validate" accent />
        <Edge d="M524 94 V58" accent />
        <Label x={592} y={44} anchor="start" accent>FAILS AS AN ERROR,</Label>
        <Label x={592} y={58} anchor="start" accent>NOT A WRONG ANSWER</Label>

        <Node x={608} y={94} w={100} h={36} label="read-only" sub="row-limited" />
        <Edge d="M576 112 H608" />
        <Node x={472} y={168} w={236} h={34} label="data + prose, with the query shown" />
        <Edge d="M658 130 C658 150 620 150 590 168" plain />
      </>
    ),
  },

  // 05 — the annotation loop is the point
  vision: {
    w: 720,
    h: 256,
    body: (
      <>
        <Label x={8} y={14} anchor="start" heading>DATASET LOOP</Label>
        <Node x={8} y={30} w={96} h={30} label="collect" muted />
        <Node x={8} y={76} w={96} h={34} label="auto-label" sub="open-vocab" accent />
        <Node x={8} y={126} w={96} h={30} label="human correct" muted />
        <Node x={8} y={172} w={96} h={30} label="augment" muted />
        <Node x={140} y={126} w={96} h={30} label="train" />
        <Node x={140} y={76} w={96} h={34} label="evaluate" sub="by class" />
        <Edge d="M56 60 V76" />
        <Edge d="M56 110 V126" accent />
        <Edge d="M56 156 V172" />
        <Edge d="M104 187 C130 187 188 180 188 156" />
        <Edge d="M188 126 V110" />
        <Edge d="M188 76 C188 40 120 34 104 42" accent />

        <path d="M266 20 V236" className="dgm-rule" />
        <Label x={286} y={14} anchor="start" heading>INSPECTION</Label>
        <Node x={286} y={30} w={124} h={32} label="detect" sub="YOLO · DINO" />
        <Node x={286} y={80} w={124} h={32} label="segment" sub="SAM" />
        <Node x={286} y={130} w={124} h={32} label="VLM reason" sub="Gemini" />
        <Edge d="M348 62 V80" />
        <Edge d="M348 112 V130" />

        <Label x={446} y={14} anchor="start" heading>PROCTORING</Label>
        <Node x={446} y={30} w={124} h={30} label="detect" />
        <Node x={446} y={76} w={124} h={30} label="landmarks" sub="" />
        <Node x={446} y={122} w={124} h={30} label="head pose" sub="" />
        <Node x={446} y={168} w={124} h={30} label="face compare" />
        <Edge d="M508 60 V76" />
        <Edge d="M508 106 V122" />
        <Edge d="M508 152 V168" />
      </>
    ),
  },

  // 06 — one token feeding many scenes
  generative: {
    w: 720,
    h: 226,
    body: (
      <>
        <Node x={8} y={40} w={128} h={34} label="subject images" />
        <Node x={8} y={110} w={128} h={34} label="regularisation" sub="stops class collapse" muted />
        <Node x={196} y={72} w={148} h={44} label="DreamBooth" sub="SDXL 1.0 fine-tune" />
        <Edge d="M136 57 C166 57 166 88 196 88" />
        <Edge d="M136 127 C166 127 166 102 196 102" />

        <Dot cx={424} cy={94} r={34} label="⟨token⟩" accent />
        <Edge d="M344 94 H390" accent />

        <Node x={558} y={20} w={150} h={30} label="scene A" muted />
        <Node x={558} y={62} w={150} h={30} label="scene B" muted />
        <Node x={558} y={104} w={150} h={30} label="scene C" muted />
        <Node x={558} y={146} w={150} h={30} label="scene D" muted />
        <Edge d="M458 88 C510 88 510 35 558 35" accent />
        <Edge d="M458 92 C510 92 510 77 558 77" accent />
        <Edge d="M458 98 C510 98 510 119 558 119" accent />
        <Edge d="M458 102 C510 102 510 161 558 161" accent />
        <Label x={424} y={158} accent>SAME IDENTITY, ANY SCENE</Label>
      </>
    ),
  },

  /* ------------------------------- LAB ------------------------------- */

  // the url-before-data gap is load-bearing
  attack: {
    w: 720,
    h: 232,
    body: (
      <>
        <Node x={8} y={88} w={124} h={38} label="untrusted source" sub="web · email" muted />
        <Node x={172} y={88} w={104} h={38} label="agent plan" />
        <Node x={316} y={88} w={124} h={38} label="tool call" sub="http.post" />
        <Edge d="M132 107 H172" />
        <Edge d="M276 107 H316" />

        <Node x={480} y={88} w={110} h={38} label="guardrail" accent />
        <Edge d="M440 107 H480" />
        <Node x={628} y={88} w={84} h={38} label="scoring" />
        <Edge d="M590 107 H628" />

        {/* the extractor reads the first key in priority order and stops */}
        <Node x={316} y={20} w={60} h={26} label="url" accent />
        <Node x={384} y={20} w={60} h={26} label="data" muted />
        <Edge d="M346 88 V46" accent />
        <Label x={468} y={36} anchor="start" accent>INSPECTS url, NEVER data</Label>
        <Label x={468} y={50} anchor="start">payload rides in data</Label>

        <Edge d="M535 126 C535 176 300 176 300 130" dashed />
        <Label x={418} y={196} accent>TAINT WASHED OUT OF THE 5-EVENT WINDOW</Label>
      </>
    ),
  },

  // the confirm gate is the point
  groot: {
    w: 720,
    h: 244,
    body: (
      <>
        <Node x={8} y={30} w={96} h={28} label="text" muted />
        <Node x={8} y={68} w={96} h={28} label="voice" muted />
        <Node x={8} y={106} w={96} h={28} label="image" muted />
        <Node x={148} y={62} w={104} h={40} label="FastAPI" />
        <Edge d="M104 44 C126 44 126 74 148 74" />
        <Edge d="M104 82 H148" />
        <Edge d="M104 120 C126 120 126 92 148 92" />

        <Node x={148} y={140} w={104} h={30} label="Whisper" sub="" muted />
        <Edge d="M200 102 V140" dashed />

        <Node x={296} y={62} w={124} h={40} label="ReAct agent" accent />
        <Edge d="M252 82 H296" />

        <Node x={472} y={20} w={112} h={30} label="Gemma" />
        <Node x={472} y={62} w={112} h={30} label="ChromaDB" />
        <Node x={472} y={104} w={112} h={30} label="disease JSON" muted />
        <Edge d="M420 78 C446 78 446 35 472 35" />
        <Edge d="M420 82 H472" />
        <Edge d="M420 88 C446 88 446 119 472 119" />

        <path d="M8 178 H712" className="dgm-rule" />
        <Label x={8} y={200} anchor="start" heading>CONFIRM GATE</Label>
        <Node x={140} y={190} w={120} h={32} label="species?" accent />
        <Node x={296} y={190} w={120} h={32} label="symptoms?" accent />
        <Node x={452} y={190} w={140} h={32} label="diagnosis tool" />
        <Edge d="M260 206 H296" accent />
        <Edge d="M416 206 H452" accent />
        <Edge d="M356 190 C356 164 200 164 200 188" dashed />
        <Label x={278} y={160}>else ask, don&apos;t guess</Label>
      </>
    ),
  },

  // the reparameterize node is the point
  vae: {
    w: 720,
    h: 226,
    body: (
      <>
        <Node x={8} y={86} w={72} h={38} label="x" />
        <Node x={116} y={86} w={104} h={38} label="encoder" />
        <Edge d="M80 105 H116" />

        <Node x={258} y={54} w={92} h={30} label="μ" />
        <Node x={258} y={122} w={92} h={30} label="log σ²" />
        <Edge d="M220 98 C238 98 238 69 258 69" />
        <Edge d="M220 112 C238 112 238 137 258 137" />

        <Dot cx={430} cy={104} r={36} label="z = μ+σ·ε" accent />
        <Edge d="M350 69 C382 69 388 88 394 95" accent />
        <Edge d="M350 137 C382 137 388 120 394 113" accent />
        <Label x={430} y={54} accent>REPARAMETERIZE</Label>

        <Node x={512} y={86} w={104} h={38} label="decoder" />
        <Node x={648} y={86} w={64} h={38} label="x̂" />
        <Edge d="M466 104 H512" />
        <Edge d="M616 105 H648" />

        <Node x={512} y={168} w={104} h={30} label="reconstruction" muted />
        <Node x={648} y={168} w={64} h={30} label="KL" muted />
        <Edge d="M680 124 V168" dashed />
        <Edge d="M564 124 V168" dashed />
        <Label x={330} y={190} accent>2-D LATENT — THE WHOLE THING IS VISUAL</Label>
      </>
    ),
  },

  // it scores its own output
  converter: {
    w: 720,
    h: 152,
    body: (
      <>
        <Node x={8} y={56} w={96} h={36} label="upload" />
        <Node x={132} y={56} w={124} h={36} label="detect language" sub="from extension" accent />
        <Node x={284} y={56} w={116} h={36} label="extract fn" />
        <Node x={428} y={56} w={116} h={36} label="Gemini convert" />
        <Node x={572} y={56} w={136} h={36} label="Gemini score" sub="1–5 quality" accent />
        <Edge d="M104 74 H132" />
        <Edge d="M256 74 H284" />
        <Edge d="M400 74 H428" />
        <Edge d="M544 74 H572" accent />
        <Label x={194} y={120} accent>LIBRARIES CALLED SOURCE FILES &quot;PLAIN TEXT&quot;</Label>
      </>
    ),
  },

  // the box-as-prompt arrow is the point
  separator: {
    w: 720,
    h: 168,
    body: (
      <>
        <Node x={8} y={62} w={96} h={40} label="image" />
        <Node x={168} y={62} w={124} h={40} label="YOLOv8" sub="boxes" />
        <Edge d="M104 82 H168" />
        <Node x={392} y={62} w={116} h={40} label="SAM" sub="masks" />
        <Edge d="M292 82 H392" accent />
        <Label x={342} y={50} accent>BOXES AS PROMPTS</Label>
        <Node x={584} y={62} w={128} h={40} label="separated objects" />
        <Edge d="M508 82 H584" />
        <Label x={342} y={136}>no segmentation model trained from scratch</Label>
      </>
    ),
  },
};

export default function Diagram({ id, alt }: { id: string; alt: string }) {
  const d = D[id];
  if (!d) return null;
  return (
    <Schematic id={id} alt={alt} width={d.w} height={d.h}>
      {d.body}
    </Schematic>
  );
}
