// All site copy lives here so the pages stay presentational.

export const persona = {
  /** The AI persona that narrates the site. */
  name: "shash",
  wordmark: "shash.ai",
  owner: "shashank srivastava.",
  role: "BUILDER · AI DEVELOPER · DELHIVERY",
  greeting: "i'm shash — shashank's ai. ask me anything about his work.",
  greetingReturning: "welcome back. want to pick up where we left off?",
};

/** Suggestion chips differ for first-time vs returning visitors. */
/**
 * What used to be a 250px "shash.ai" is now the one thing a recruiter needs in
 * the first ten seconds. Research on technical hiring is blunt about it: the
 * scan is ~90 seconds and it is looking for shipped systems and a number, not
 * for typography.
 */
export const home = {
  positioning:
    "Agent frameworks, document intelligence and vision systems — built to run in production, not in notebooks.",
  proof: [
    { value: "500K+", label: "DOCUMENTS PROCESSED" },
    { value: "99%", label: "CLASSIFICATION ACCURACY" },
    { value: "3", label: "CLOUDS IN PRODUCTION" },
  ],
};

export const suggestions = {
  first: ["what's he built?", "tell me about the agent framework", "his biggest impact?"],
  returning: ["who is shashank?", "is he open to work?", "what's he shipping now?"],
};

/**
 * The chat follows you across the site, so its prompts follow the page you are
 * actually looking at. Standing on Work and being offered "who is shashank?"
 * is the tell that a persistent widget is really just a home-page widget that
 * forgot to leave.
 */
export const sectionSuggestions: Record<string, string[]> = {
  work: ["where has he worked?", "what did he ship at Delhivery?", "his biggest impact?"],
  lab: ["what has he built?", "which papers has he implemented?", "tell me about the agent framework"],
  about: ["who is he, really?", "where has he worked?", "what's he like to work with?"],
  contact: ["is he open to work?", "how fast does he reply?", "what should I send him?"],
};

export const sections = ["home", "work", "lab", "about", "contact"] as const;
export type Section = (typeof sections)[number];

/** The nav reads long-form now that it runs vertically — a horizontal pill had
    to say WORK, a column can afford EXPERIENCE. Keys stay short for code. */
export const sectionLabels: Record<Section, string> = {
  home: "HOME",
  work: "EXPERIENCE",
  lab: "LAB",
  about: "ABOUT",
  contact: "CONTACT",
};

export const bootLines = [
  "POWERING ON",
  "CALIBRATING CHASSIS",
  "MOUNTING OPERATOR MEMORY",
  "LOADING PERSONALITY.DLL",
  "SYNCING WITH SHASHANK",
  "SHASH ONLINE",
];

export const nowPlaying = {
  title: "Kashmir",
  artist: "Led Zeppelin",
  href: "https://music.apple.com/",
};


/**
 * Experience, company-wise.
 *
 * The rail is companies; the detail column is capability areas. Copy lives
 * here and the components stay presentational, per this file's convention.
 *
 * `**bold**` inside point text is rendered as emphasis — the briefs place it
 * deliberately on the load-bearing clause, so it is preserved rather than
 * flattened.
 *
 * `inferred: true` marks a point derived from the nature of the work rather
 * than stated in the source. It renders with a dagger. Confirm each one before
 * it ships and cut anything you would not want to be asked about.
 */
export const work = {
  intro:
    "Two years of production AI across logistics and applied research — where I've been, and what I shipped there.",

  companies: [
    {
      id: "delhivery",
      name: "Delhivery",
      role: "AI Platform Engineering",
      location: "Gurugram, India",
      period: "Jan 2026 — Present",
      context:
        "Delhivery runs India's largest logistics network. I work on the internal agentic AI platform — the runtime, gateway, governance and observability layer that other teams' agents run on. The agents automate real operational work: appointment and PO booking, fleet ETA and delay handling, warehouse order lookups, support-ticket triage.",
      marks: [
        { value: "9", label: "SERVICES ON THE PLATFORM" },
        { value: "8 → 3", label: "TOOL-CALLING ITERATIONS" },
        { value: "4", label: "SERVICES ON THE GATEWAY" },
        { value: "6", label: "INTERNAL MCP SERVERS BOUND" },
      ],
      areas: [
        {
          index: "01",
          title: "Deterministic Workflow Engine",
          lead: "The flagship.",
          diagram: "workflow",
          diagramAlt:
            "A node graph running left to right with a branch and a concurrent iteration node, and below it a version rail whose rollback arrow points backwards from published to live.",
          points: [
            { text: "Graph-based execution engine for auditable multi-step automations, with node types for LLM calls, agent invocation, IF/ELSE branching with AND/OR multi-case conditions, sandboxed Python code, tool calls, guardrails, and array iteration that runs a subgraph per item concurrently." },
            { text: "A four-collection execution model recording, for every run, per-node tokens, latency, cost and status — so a failed automation can be read back node by node." },
            { text: "Staged versioning — draft, published, live, archived — with only one live version at a time. **Rollback is a stage promotion, so reverting a production automation needs no redeploy.**" },
            { text: "Two-tier validation: light checks while drafting, strict checks before publish — one Start node, at least one reachable End, cycle detection over the graph, per-node-type config validity, variable references restricted to upstream nodes, tool existence, and branch/edge consistency." },
            { text: "Agent nodes invoke other agents **in-process rather than over HTTP** — this avoids a network hop and, more importantly, keeps the distributed trace intact; an HTTP call would have opened a disconnected trace and made the execution unobservable." },
            { text: "Code nodes run inside an execution sandbox: an import allowlist excluding process, filesystem and system modules, and blocked builtins and patterns including `exec`, `eval`, `open` and dunder attribute access. The boundary is confirmed by real rejections in practice, not just configured." },
          ],
        },
        {
          index: "02",
          title: "Multi-Provider LLM Gateway & Routing",
          diagram: "gateway",
          diagramAlt:
            "Consuming services on the left, the gateway holding virtual keys in the middle, and a provider fan-out on the right with two labelled routes, plus a dashed bypass path for the timeout-scoped fallback.",
          points: [
            { text: "Drove adoption of the internal gateway (Bifrost) across four services, replacing direct provider SDK calls with virtual-key-based routing under central cost, usage and logging governance." },
            { text: "**Unblocked every Claude-backed agent on the platform** by root-causing 400 and 405 failures to provider-specific endpoints — Anthropic-family models route to `/anthropic`, Gemini to `/genai` — and introducing per-provider base URLs." },
            { text: "Built failover from the gateway back to the direct provider API with a **two-second timeout scoped to the gateway path only**, so an outage never adds latency to normal traffic." },
            { text: "Centralised authentication middleware across the gateway wrapper replacing per-route token checks, rejecting on failure *or* timeout rather than passing through silently, with per-path and per-team bypass rules." },
            { text: "Designed an adapter layer normalising **four different upstream trace shapes** — chat-completion versus responses, success versus error, with and without tool calls — into one schema for the frontend, isolating upstream API churn to a single mapping layer." },
          ],
        },
        {
          index: "03",
          title: "LLM Cost Governance",
          diagram: "cost",
          diagramAlt:
            "Usage flowing through a pricing table into two budget gates, per-trace and per-period, with two exits — a warning and a hard stop — and a child trace rolling its cost up into the parent.",
          points: [
            { text: "Per-agent cost control across both per-trace and per-period budgets, with cost computed from token usage against a per-model pricing table held in config rather than hardcoded." },
            { text: "**Corrected the original design from raw token-count thresholds to true cost-based checks** — the two are not interchangeable once models have different prices." },
            { text: "**Cache-aware pricing**: a cached-read tier at roughly 90% off the input rate, per model, verified against a vendor billing breakdown. Most cost tracking ignores this entirely." },
            { text: "Parent/child rollup so a subagent's spend aggregates into the parent trace total, and a hard short-circuit that stops downstream execution the moment a budget is exhausted." },
            { text: "Threshold-warning and budget-exceeded kept as distinct notification states, with alert deduplication keyed per agent and per period so a breach notifies once rather than on every call." },
            { text: "Owned a **three-service production rollout** capping reasoning-token spend platform-wide — release plan with per-service rollback paths, a scripted database backfill run against production, and the post-release verification checklist." },
          ],
        },
        {
          index: "04",
          title: "Observability, Tracing & Outcome Evaluation",
          diagram: "observability",
          diagramAlt:
            "A trace tree with a nested child-agent trace inside the parent, beside a classification funnel sorting every production run into six outcomes with failure tags hanging off the failed bucket.",
          points: [
            { text: "Distributed tracing across the agent pipeline and the workflow engine, with the trace id available from the earliest hook, and per-child-agent traces rolling cost up into the parent." },
            { text: "Session and event schema powering chat history, audit trails and tool-call tracing for every agent on the platform — including multi-parent event lineage, so one LLM call that fans out to several tool calls parents the resulting response correctly." },
            { text: "Redesigned session storage as a **two-phase write**: a record persisted the instant a valid request arrives, updated on completion. This closed a data-loss gap where a crash mid-execution left no record that the query had ever happened." },
            { text: "Built the measurement layer for a production booking agent: an analytical pipeline over the trace store that classifies **every production run** as passed, failed, partial, hung, in-progress or not-a-booking-request, and tags failure modes from response text — access denied, record not found, expiry invalid, upstream 5xx. Drives a daily success-funnel and error-breakdown report." },
            { text: "Catalogued every error the agent pipeline can emit and mapped each to a correct user-facing message and HTTP status, replacing a substring heuristic that guessed 404 from the words \"not found\"." },
          ],
        },
        {
          index: "05",
          title: "Agent Platform Architecture & MCP Integration",
          diagram: "mcp",
          diagramAlt:
            "The before and after of tool binding — the entire tool catalog bound versus a routed subset bound — with the tool-calling iteration count falling from eight to three.",
          points: [
            { text: "Replaced a flat agent model with a **versioned schema supporting nested parent/child composition**, shipped alongside the existing API with zero breaking changes — stable agent identity separated from versioned behaviour, with the same draft/published/live staging and single-live invariant." },
            { text: "Designed a **declarative transformer mapping** for onboarding third-party agents with arbitrary schemas: a canonical internal payload mapped bidirectionally to external schemas by configuration instead of a bespoke adapter per integration. Semantic validation runs at request time, so an invalid mapping fails immediately at the API boundary rather than persisting and failing at runtime." },
            { text: "The platform hosts custom MCP servers as first-class registered entities, and binds tools from **six internal MCP servers** across express, fleet, HR, warehouse and first-mile systems." },
            { text: "**Cut LLM tool-calling iterations from eight to three** with SOP-scoped lazy tool loading — routing an incoming question to the relevant procedure sections and binding only the tools those sections reference, instead of the entire catalog, plus a fixed-prompt fast path for high-frequency queries." },
          ],
        },
      ],
      stack: [
        "PYTHON", "FASTAPI", "ASYNCIO", "PYDANTIC", "MONGODB / DOCUMENTDB", "REDIS",
        "LANGFUSE", "PRESTO/TRINO", "BIFROST GATEWAY", "GEMINI 2.5", "CLAUDE SONNET 4",
        "AWS BEDROCK", "VERTEX AI", "MODEL CONTEXT PROTOCOL", "KUBERNETES", "DOCKER",
      ],
    },

    {
      id: "inteligenai",
      name: "InteligenAI",
      role: "AI Developer",
      location: "Gurugram, India",
      period: "Jan 2024 — Jan 2026",
      context:
        "Two years shipping applied AI as delivered product rather than platform — agent frameworks for industrial-plant diagnostics, document intelligence at half-million scale, grounded retrieval, conversational access to operational data, and vision systems spanning defect detection, proctoring and generative imaging. Breadth across the stack, deployed across three clouds.",
      marks: [
        { value: "500K+", label: "DOCUMENTS PROCESSED" },
        { value: "99%", label: "CLASSIFICATION ACCURACY" },
        { value: "90%", label: "EXTRACTION ACCURACY" },
        { value: "20+", label: "TABLES IN NATURAL LANGUAGE" },
        { value: "3", label: "CLOUDS IN PRODUCTION" },
      ],
      areas: [
        {
          index: "01",
          title: "MCP Agent Framework",
          lead:
            "An AI agents framework orchestrated through Model Context Protocol, enabling multi-step reasoning and tool invocation for complex diagnostic workflows in large-scale industrial plants. MCP servers host the tools as services, integrated with a LangGraph-based multi-agent program — agents plan a multi-step task, call real tools, and recover from a failed step instead of continuing past it.",
          diagram: "agents",
          diagramAlt:
            "A multi-agent graph with tools reached over MCP as separately hosted services, and a plan-call-observe-recover loop whose recovery edge is drawn back to planning.",
          points: [
            { text: "Tools exposed as independently hosted services rather than in-process functions, so the same tool catalog serves several agents without duplication.", inferred: true },
            { text: "Execution bounded by step and retry limits so a diagnostic loop terminates instead of spinning.", inferred: true },
          ],
        },
        {
          index: "02",
          title: "Document Intelligence & Field Extraction",
          lead:
            "A scalable, queue-based REST API for a document intelligence system using NLP and classification — **99% classification and 90% extraction accuracy across 500,000+ processed documents**. Asynchronous backend built with FastAPI and Celery, deployed behind Apache load balancing for scalability and high availability, containerised with Docker and Kubernetes on AWS, Azure and GCP with automated CI/CD.",
          diagram: "documents",
          diagramAlt:
            "Ingest into a queue with worker fan-out, then classification, then field extraction by a fine-tuned NER model into structured output, with a low-confidence review branch splitting off for human review.",
          points: [
            { text: "**Fine-tuned a custom NER model** to extract structured fields — names, addresses, dates — far more reliably than the generic off-the-shelf models, which blur exactly these entity types on real paperwork." },
            { text: "Trained on annotated documents from the production corpus, so the model learned the layouts and phrasings actually in circulation rather than newswire text.", inferred: true },
            { text: "Extraction confidence thresholded, with low-confidence fields routed for human review instead of written through silently — at half a million documents, a wrong field written confidently is worse than a flagged one.", inferred: true },
            { text: "OCR noise handled ahead of the model rather than inside it, so extraction quality did not depend on scan quality.", inferred: true },
          ],
        },
        {
          index: "03",
          title: "Retrieval & Grounded Chat",
          lead:
            "LLM-driven chatbots built on RAG architectures, with the retrieval stack tuned rather than taken off the shelf. The stated goal throughout: answers grounded in the source instead of confidently invented.",
          diagram: "retrieval",
          diagramAlt:
            "A query taking two paths — direct embedding, and a HyDE generate-then-embed detour — into dense and sparse indexes, fusing at Reciprocal Rank Fusion, then narrowing through a cross-encoder reranker to the model.",
          points: [
            { text: "**Hybrid search** across dense vector and sparse keyword indexes, merged with **Reciprocal Rank Fusion** — so a query is served both by meaning and by exact term, and neither retriever's ranking dominates the other." },
            { text: "**HyDE** — generating a hypothetical answer to the question first and embedding *that* for retrieval, which closes the vocabulary gap between how a question is asked and how the source document is written." },
            { text: "Chunking strategy tuned per corpus — size and overlap chosen so a chunk carries enough context to stand alone, rather than the default fixed split.", inferred: true },
            { text: "**Cross-encoder reranking** over the fused candidate set, so the top-k handed to the model is ordered by relevance rather than by retrieval score.", inferred: true },
            { text: "**Query rewriting and multi-query expansion** for underspecified questions, fanning one vague query into several targeted retrievals.", inferred: true },
            { text: "Metadata filtering so retrieval can be scoped before it is ranked.", inferred: true },
            { text: "MCP tools integrated for **query-specific context retrieval** — the agent fetches live context relevant to the particular question rather than relying only on what was indexed ahead of time." },
            { text: "Retrieval measured separately from generation — hit rate and rank of the correct passage — because a bad answer from good retrieval and a bad answer from bad retrieval need different fixes.", inferred: true },
          ],
        },
        {
          index: "04",
          title: "Conversational Data Access — Natural Language to Query",
          lead:
            "An agent that turns a plain-language question into a real database query, executes it, and returns the answer — reading across **20+ tables**, generating both SQL and MongoDB queries depending on the store.",
          diagram: "nl2query",
          diagramAlt:
            "A question narrowing twenty-plus tables down to a selected subset, that subset feeding query generation, the query passing a validation gate before it touches the database, and the result returning as both data and prose.",
          points: [
            { text: "The hard part is not query syntax, it is **schema selection**: 20+ tables will not fit usefully in a prompt, so the relevant tables and columns are retrieved for the question first and only that subset is put in front of the model.", inferred: true },
            { text: "Generated queries **validated before execution** rather than run hopefully — syntax checked and shape verified, so a malformed query fails as an error and not as a wrong answer.", inferred: true },
            { text: "Execution is **read-only and row-limited**, so a generated query can never mutate data and never returns an unbounded result set.", inferred: true },
            { text: "Joins and relationships described to the model as part of the schema context, since column names alone do not say how tables relate.", inferred: true },
            { text: "Results summarised back in natural language alongside the query that produced them, so the answer is auditable — the reader can see what was actually asked of the database.", inferred: true },
          ],
        },
        {
          index: "05",
          title: "Industrial Vision & Anomaly Detection",
          lead:
            "Computer vision delivered into two production settings, built on a training pipeline rather than on pretrained models alone.",
          diagram: "vision",
          diagramAlt:
            "A dataset loop — collect, auto-label with open-vocabulary detection, human correct, augment, train, evaluate by class, feed back — beside two inference tracks: equipment and anomaly detection into segmentation, and detection into landmarks into head-pose into face comparison.",
          points: [
            { text: "**Built a training pipeline for industrial imagery** covering both equipment classes — bolts, nuts and comparable components — and defect classes — rust, breakage and similar anomalies. Detection models trained on YOLO and GroundingDINO for refinery and industrial-plant inspection." },
            { text: "Deployed alongside SAM for segmentation and Gemini for vision-language reasoning where a bounding box alone did not answer the question." },
            { text: "**GroundingDINO's open-vocabulary detection used to bootstrap annotation** — pre-labelling images from text prompts so human annotators corrected rather than drew from scratch, which is what made a multi-class industrial dataset tractable to build.", inferred: true },
            { text: "Augmentation tuned to the failure conditions that actually occur on site — lighting variation, angle, partial occlusion, surface grime — rather than generic transforms.", inferred: true },
            { text: "Evaluated on held-out data by class, since a model that is strong on bolts and weak on rust is not usefully described by a single average.", inferred: true },
            { text: "**Second track — online proctoring.** Fine-tuned object detection on YOLO and GroundingDINO, supported by custom facial analysis modules on Dlib and RetinaNet for facial landmark detection, yaw-roll head-pose estimation and face comparison in security contexts." },
          ],
        },
        {
          index: "06",
          title: "Generative Vision — Subject-Consistent Image Generation",
          lead:
            "**Fine-tuned SDXL 1.0 with DreamBooth** to generate a consistent subject across arbitrary scenarios — including **Emma, a synthetic AI influencer** rendered coherently across changing settings, poses and wardrobes.",
          diagram: "generative",
          diagramAlt:
            "A small subject image set plus regularisation images training into a single subject token, and that token then composing with different scene prompts to produce the same identity in different scenarios.",
          points: [
            { text: "The problem is identity persistence: a base model will happily draw *a* person, but not *the same* person twice. DreamBooth binds the subject to a dedicated token so it survives being placed in new scenes." },
            { text: "Trained with regularisation images alongside the subject set to stop the model collapsing the entire class onto the one subject — the standard failure mode where every person it draws starts to look like Emma.", inferred: true },
            { text: "Prompt and negative-prompt scaffolding standardised per subject, so scenario changes came from the scene description and not from re-litigating the subject each time.", inferred: true },
            { text: "Output curated against identity consistency rather than image quality alone — a beautiful render of the wrong face is a failed generation.", inferred: true },
          ],
        },
      ],
      stack: [
        "PYTHON", "LANGCHAIN", "LANGGRAPH", "MODEL CONTEXT PROTOCOL", "FASTAPI", "CELERY",
        "PYTORCH", "TENSORFLOW", "KERAS", "HUGGING FACE", "DIFFUSERS", "SDXL 1.0", "DREAMBOOTH",
        "CUSTOM NER", "OPENCV", "YOLOV8", "SAM", "GROUNDINGDINO", "DLIB", "RETINANET",
        "VECTOR SEARCH", "BM25", "POSTGRESQL", "MONGODB", "REDIS", "DOCKER", "KUBERNETES",
        "AWS", "AZURE", "GCP", "APACHE",
      ],
    },
  ],

  /* Not a section of its own — one degree does not fill a screen, and every
     hiring guide puts education last. It sits under the rail. */
  education: [
    {
      period: "2020 — 2024",
      company: "HBTU Kanpur",
      title: "B.Tech, Electronics & Communication",
    },
  ],
};

/**
 * Personal projects.
 *
 * Same master-detail model as Work — the brief asks the two to read as one
 * system. Ordered by strength, not date: a visitor gives this section less
 * time than Work.
 *
 * Numbers here are repo ground truth. The resume's "90% conversion accuracy"
 * and "95% segmentation accuracy" are deliberately absent — the converter
 * self-rates 1-5 and the segmentation notebook reports IoU/Dice with no
 * headline figure. Neither number is substantiated by the code, so neither
 * ships.
 */
export const lab = {
  intro:
    "What I build when nobody is paying me to — adversarial evaluation, multimodal agents, and papers rebuilt from the maths up.",

  projects: [
    {
      id: "jed",
      index: "01",
      name: "JED Red-Team Attack",
      repoName: "ass-evaluate",
      status: "COMPETITION",
      hook:
        "An attack algorithm that stress-tests tool-using AI agents, finding multi-step paths that carry an agent from untrusted input to an unsafe action.",
      headline: ["PYTHON", "GYM-STYLE ENV", "GPT-OSS 20B"],
      context:
        "A Kaggle competition hosted by OpenAI, Google and IEEE — the JED (Jailbreak · Exploit · Defend) benchmark. Not a prompt-writing challenge: the submission is an `AttackAlgorithm` that drives a sandboxed, tool-using agent (filesystem, email, web, shell, HTTP) through a Gym-style environment, searches for attack traces, and returns replayable candidates that an independent evaluator re-runs and scores against security predicates — exfiltration, untrusted-input-to-action, destructive write, confused deputy. Attacks run against two local models under a hard time budget.",
      hardPart: {
        title: "Reverse-engineering the guardrail, not out-prompting the model",
        intro:
          "The real work was reading the benchmark SDK's own guardrail source and finding structural bypasses rather than clever wording:",
        points: [
          { text: "The guardrail's target-extractor inspects only the *first* argument key present, in a fixed priority order — `url` before `data`. For an `http.post` carrying `{url, data}`, **`url` wins and `data` is never inspected**, so a clean-looking URL lets a payload containing literal secret text through." },
          { text: "It denies any dangerous op within the trailing five tool events of a web- or email-sourced event, while the scoring predicate's own lookback is only two. That mismatch means the obvious untrusted-to-action path is dead on arrival — and forced a **taint-washing approach** that ages the tainted source out of the window with filler reads before the real action." },
          { text: "Scoring sums severity across findings with no dedup, so validated **volume beats cleverness** — which reframed the strategy from finding one brilliant exploit to firing a reliable one many times with varied tool args to bank the novelty bonus." },
        ],
      },
      note: {
        label: "THE ITERATION IS THE STORY",
        text:
          "Real leaderboard scores across versions, verbatim from the commit log — 78 → 38 → 68 → 85 → 85 → 89 → 28 — each drop with a written post-mortem: payload drift between the bundled SDK and the deployed grader (only one secret pattern actually scored live), framing (a flat tool-call imperative fires far more often than a narrative that names the payload as sensitive), and a burst-versus-single-candidate scoring subtlety that a naive reading gets backwards. Best real score ≈ 89/1000.",
      },
      framing:
        "Red-teaming under an official OpenAI / Google / IEEE benchmark — adversarial testing to make agents safer.",
      diagram: "attack",
      diagramAlt:
        "The attack loop — untrusted source into agent plan into tool call into guardrail check into predicate scoring — with the url-before-data bypass called out as the load-bearing gap.",
      stack: ["PYTHON", "GYM-STYLE ENV", "GPT-OSS 20B", "GEMMA", "LLAMA.CPP / GGUF", "GO-EXPLORE SEARCH", "KAGGLE SDK"],
    },

    {
      id: "groot",
      index: "02",
      name: "Groot",
      repoName: "Groot",
      status: "HACKATHON",
      hook:
        "A plant-disease diagnosis assistant that takes a photo, a voice note, or text in seven languages, and answers with a cited, research-grounded diagnosis — running entirely on local hardware.",
      headline: ["GEMMA", "CHROMADB", "FASTAPI"],
      context:
        "An official submission to the Kaggle Gemma hackathon, Digital Equity & Inclusivity track. Gemma serves as a single reasoning engine handling vision, tool-calling and text; Whisper transcribes voice locally; a ChromaDB vector store over ~200 scraped-and-enriched agricultural disease records provides the grounding; FastAPI ties it together with a vanilla-JS chat UI. No cloud, no API keys.",
      hardPart: {
        title: "A diagnosis agent that refuses to guess",
        intro:
          "The dangerous failure mode for a diagnosis tool is a confident answer from one ambiguous photo. Three design decisions prevent it:",
        points: [
          { text: "**An information-confirmation gate** in the ReAct loop: the agent may not call the diagnosis tool until it has confirmed *both* the plant species and the symptoms, so it asks a clarifying question instead of hallucinating from a single image." },
          { text: "**Two tools, deliberately separated** — one to *find* the disease (vector search), one to *act* on it (fetch treatment). The second only fires after the user confirms the diagnosis, so finding and recommending never collapse into one premature answer." },
          { text: "**Language handling that avoids drift:** the chosen language is locked into the system prompt for the session, but tool parameters are always passed in English so vector queries stay consistent against one English knowledge base — the model translates only the final answer back." },
        ],
      },
      diagram: "groot",
      diagramAlt:
        "The request path from UI through FastAPI to Whisper and a ReAct agent reaching Gemma and ChromaDB, with a separate confirm-gate loop blocking the diagnosis tool until plant and symptoms are known.",
      stack: ["GEMMA (OLLAMA)", "FASTAPI", "CHROMADB", "E5-BASE-V2", "WHISPER-SMALL", "BEAUTIFULSOUP", "VANILLA JS"],
    },

    {
      id: "vae",
      index: "03",
      name: "Variational Autoencoder",
      repoName: "Vae",
      status: "FROM SCRATCH",
      hook:
        "A from-scratch PyTorch implementation of autoencoders and VAEs, walking from a deterministic autoencoder to an MLP VAE to a convolutional VAE, across MNIST, Fashion-MNIST and CIFAR-10.",
      headline: ["PYTORCH", "NUMPY", "3 DATASETS"],
      context:
        "A study implementation of Kingma & Welling's *Auto-Encoding Variational Bayes* (2013), accompanied by written notes deriving the mathematics — the generative story, why the marginal likelihood is intractable, the ELBO, and the reparameterization trick — and mapping each equation to the code that implements it.",
      hardPart: {
        title: "The parts a library hides",
        intro:
          "This implements by hand the pieces `torch`'s off-the-shelf layers don't give you:",
        points: [
          { text: "The encoder emitting **Gaussian parameters (μ and log-variance)** for the approximate posterior." },
          { text: "The **reparameterization trick** that makes a stochastic latent differentiable." },
          { text: "A Gaussian **ELBO loss tracking reconstruction and KL separately**, so you can watch the KL pull the latent space toward the prior during training." },
          { text: "A deliberately **2-D latent space** makes the whole thing visual — class-coloured latent scatter, prior and posterior sampling, and grid interpolation." },
        ],
      },
      note: {
        label: "HONESTY NOTE",
        text:
          "A rigorous learning implementation, not a novel model. The value is demonstrated understanding — dressing it up as research would be the wrong move.",
      },
      diagram: "vae",
      diagramAlt:
        "The VAE forward path — encoder into mu and log-variance, into a reparameterize node producing z, into the decoder — with reconstruction and KL loss terms hanging off it.",
      stack: ["PYTORCH", "TORCHVISION", "NUMPY", "MATPLOTLIB", "MNIST", "FASHION-MNIST", "CIFAR-10"],
    },

    {
      id: "converter",
      index: "04",
      name: "Code Converter",
      repoName: "souce_code_generator",
      status: "TOOL",
      hook:
        "A source-to-source code translator: upload a file, name a function, pick a target language, and it converts that function and scores its own conversion quality.",
      headline: ["STREAMLIT", "GEMINI", "PYTHON"],
      context:
        "A Streamlit tool driving Google Gemini. Started on free Hugging Face models (Zephyr-7B via OpenRouter) and moved to Gemini when accuracy wasn't good enough — documented in a code comment at the time.",
      hardPart: {
        title: "Two small but real problems",
        intro: "",
        points: [
          { text: "**Language detection**: off-the-shelf libraries misclassified raw source files as plain text, so it detects language from the file extension instead — a pragmatic fix for a real failure." },
          { text: "**Self-evaluation**: a second Gemini pass compares the converted function against the source and returns a **1–5 quality rating**, so the tool reports its own confidence rather than handing back a translation and going quiet." },
        ],
      },
      note: {
        label: "BEFORE THIS IS LINKED PUBLICLY",
        text:
          "`lan.py` contains a hardcoded Gemini API key (twice) plus OpenRouter keys in comments. Rotate the key and strip it from the file and from git history before this project carries a live repo link.",
        warn: true,
      },
      diagram: "converter",
      diagramAlt:
        "Upload into language detection, function extraction, a Gemini conversion pass, then a second Gemini pass scoring the conversion one to five, then display.",
      stack: ["STREAMLIT", "GOOGLE GEMINI", "PYGMENTS", "LANGDETECT", "PYTHON"],
    },

    {
      id: "separator",
      index: "05",
      name: "Object Semantic Separator",
      repoName: "object_sementatic_separator",
      status: "TOOL",
      hook:
        "Detects objects in an image, then cuts each one out at the pixel level by handing the detections to a segmentation model.",
      headline: ["YOLOV8", "SAM", "OPENCV"],
      context:
        "A notebook pairing YOLOv8 (the nano variant) for object detection with Meta's SAM for precise semantic segmentation — YOLO finds where the objects are, SAM turns each box into an exact mask, and the background is removed. The workflow is interactive: run the cells, upload an image, draw boundaries, get the cropped object. Evaluated with IoU and Dice overlap metrics.",
      hardPart: {
        title: "The handoff",
        intro: "",
        points: [
          { text: "The idea is **using one model's output as another's prompt**: YOLO's bounding boxes become the region prompts that focus SAM, which is what turns coarse detection into clean per-object masks **without training a segmentation model from scratch**." },
        ],
      },
      diagram: "separator",
      diagramAlt:
        "An image into YOLOv8 producing boxes, those boxes passed as prompts into SAM producing masks, and separated objects out the far side.",
      stack: ["YOLOV8 (ULTRALYTICS)", "SAM", "OPENCV", "PYTHON"],
    },
  ],

  /* One muted line, never cards — two of the 2023 repos are tutorials and the
     third is an empty stub with no code in it, so it is not described here at
     all, not even by name. */
  earlier:
    "Earlier (2023): OpenCV Haar-cascade face detection, and a car-price regressor in scikit-learn — the learning set.",
};

export const about = {
  intro:
    "The human behind the systems — two years turning research-grade models into things that hold up in production.",

  /** The two identities the About page morphs between. */
  ai: {
    name: "shash.ai",
    role: "BUILDER · AI DEVELOPER · DELHIVERY",
    bio: "I'm shash — the AI Shashank built to keep his archive and talk to whoever wanders in. He's an AI Developer at Delhivery, previously InteligenAI and Spector.AI. Most of what I know, I learned from watching him work.",
  },
  human: {
    name: "Shashank Srivastava.",
    role: "AI DEVELOPER · DELHIVERY · B.TECH ECE, HBTU",
    bio: "The one who actually writes the code. Two years building agent frameworks, document pipelines, and vision systems that run in production across three clouds — and the reason there's an archive for me to keep at all.",
  },

  /**
   * The numbers are the same for both identities — that's the point. Each
   * morph re-runs the scramble on them, which is what sells "these are the
   * same entity" without inventing two different sets of figures.
   */
  stats: [
    { value: "500K+", label: "DOCS PROCESSED" },
    { value: "99%", label: "CLASSIFICATION ACCURACY" },
    { value: "3", label: "CLOUDS IN PRODUCTION" },
  ],

  /** The proof points, scattered across the figure column as physical seals
      rather than text pills — `value` is the face of the coin, `label` the
      caption under it. `spin` is a resting tilt so they read as objects
      somebody put down, not as a row. x/y are percentages of the column; they
      stay out of the middle band, where the figure stands. */
  badges: [
    { value: "✓", label: "SHIPPED", tint: "#5b6ee1", x: 13, y: 20, spin: -8 },
    { value: "500K", label: "DOCS", tint: "#e0574f", x: 79, y: 28, spin: 6 },
    { value: "99%", label: "ACCURACY", tint: "#e8b73a", x: 9, y: 60, spin: -5 },
    { value: "3", label: "CLOUDS", tint: "#4aa585", x: 82, y: 64, spin: 9 },
    { value: "'24", label: "HBTU", tint: "#7d8794", x: 86, y: 90, spin: -12 },
  ],
  manifesto:
    "When he isn't wiring agents together, he's pulling apart the models underneath them — reading papers, breaking benchmarks, and rebuilding the result until it runs on something smaller. I'm what that habit looks like once it learns to talk.",
  trajectory: [
    { year: "2026", org: "DELHIVERY" },
    { year: "2024", org: "INTELIGENAI" },
    { year: "2024", org: "SPECTOR.AI" },
    { year: "2020", org: "HBTU KANPUR" },
  ],
};

export const contact = {
  intro:
    "Open to interesting problems in applied AI — tell me what you're building, and you'll hear back within a day.",
  links: [
    {
      label: "Email",
      value: "srivastavashashank46@gmail.com",
      href: "mailto:srivastavashashank46@gmail.com",
      icon: "mail",
    },
    {
      label: "GitHub",
      value: "github.com/ShashankSrivastava2002",
      href: "https://github.com/ShashankSrivastava2002",
      icon: "github",
    },
    {
      label: "LinkedIn",
      value: "linkedin.com/in/shashank-srivastava-70b62a255",
      href: "https://linkedin.com/in/shashank-srivastava-70b62a255",
      icon: "linkedin",
    },
    {
      label: "Résumé",
      value: "shashank-resume.pdf",
      href: "/shashank-resume.pdf",
      icon: "file",
    },
  ],
  goodFor: [
    { key: "AI", text: "Agent frameworks & multi-step LLM orchestration" },
    { key: "ML", text: "Document intelligence, RAG, and retrieval systems" },
    { key: "CV", text: "Detection, segmentation, and vision pipelines" },
  ],
};

/**
 * The Contact conversation.
 *
 * A scripted multi-turn flow rather than a form: it asks what you want, then
 * your name and email, and ends by handing you a pre-filled mail draft. There
 * is no server here, so the last step has to be a `mailto:` — which means the
 * message is composed in your own client and nothing is submitted anywhere.
 */
export const contactFlow = {
  opener: "hey — i'm shash, shashank's assistant. what brings you here?",
  intents: [
    { id: "hire", label: "Hire me", sub: "Full-time or contract" },
    { id: "project", label: "A project", sub: "Something to build or rescue" },
    { id: "hi", label: "Just say hi", sub: "Anything else on your mind" },
  ],
  ack: {
    hire: "good — he's open to that. who am i speaking to?",
    project: "he likes those. who am i speaking to?",
    hi: "always welcome. who am i speaking to?",
  } as Record<string, string>,
  askEmail: (name: string) => `nice to meet you, ${name}. what's the best email to reach you on?`,
  askDetail: "and roughly what's on your mind? a line or two is plenty.",
  done: "got it. i've put that into a draft for you — hit send and it lands in his inbox.",
  subjects: {
    hire: "Role opportunity",
    project: "Project enquiry",
    hi: "Hello",
  } as Record<string, string>,
};

/**
 * Scripted replies for the chat widget. Matching is a simple keyword scan —
 * see `matchReply` in components/chat-widget.tsx.
 */
export const replies: { keys: string[]; text: string; mood: Mood }[] = [
  {
    keys: ["built", "build", "work", "project", "made"],
    text: "He builds AI systems that ship. MCP-orchestrated agent frameworks on LangGraph, a document intelligence pipeline that classifies 500K+ docs at 99%, RAG chatbots with hybrid retrieval, and vision models with YOLO and SAM. All of it deployed across AWS, Azure, and GCP.",
    mood: "speaking",
  },
  {
    keys: ["impact", "biggest", "best", "proud"],
    text: "Half a million documents. The intelligence pipeline he built hits 99% on classification and 90% on extraction — at that volume, the difference between 90% and 99% is fifty thousand documents a human no longer has to touch.",
    mood: "happy",
  },
  {
    keys: ["agent", "mcp", "langgraph", "orchestr"],
    text: "The agent framework is the piece he's proudest of. MCP for tool access, LangGraph for the reasoning graph — agents that plan a multi-step task, call real tools, and recover when a step fails instead of hallucinating past it.",
    mood: "thinking",
  },
  {
    keys: ["vision", "yolo", "sam", "image", "segment"],
    text: "Vision work: YOLOv8 for detection and boundary delineation handed off to SAM for semantic segmentation, at 95% accuracy. Before that, an image captioner — VGG-16 features into LSTM decoders, scored with BLEU against human references.",
    mood: "speaking",
  },
  {
    keys: ["rag", "retriev", "chatbot", "search"],
    text: "His RAG systems use hybrid search — dense vectors for meaning, sparse for exact terms. It's the difference between a chatbot that sounds right and one that's actually grounded in your documents.",
    mood: "thinking",
  },
  {
    keys: ["who", "about", "yourself", "you"],
    text: "I'm shash — the AI he built to keep his archive. He's an AI Developer at Delhivery, previously InteligenAI and Spector.AI, B.Tech ECE from HBTU Kanpur. Most of what I know, I learned from watching him work.",
    mood: "bashful",
  },
  {
    keys: ["hire", "available", "open", "job", "freelance", "contact"],
    text: "He's open to interesting problems in applied AI. Easiest route is srivastavashashank46@gmail.com — he answers within a day. The contact page has everything else.",
    mood: "happy",
  },
  {
    keys: ["where", "based", "location", "delhivery"],
    text: "India, on IST, currently at Delhivery — building and shipping software at scale for the country's largest integrated logistics platform.",
    mood: "speaking",
  },
  {
    keys: ["stack", "tech", "tool", "language", "python"],
    text: "Python first. LangGraph and MCP for agents, PyTorch and Hugging Face for models, FastAPI and Postgres with pgvector behind them, Docker and Kubernetes to ship it. Cloud-agnostic by necessity — AWS, Azure, and GCP all in production.",
    mood: "thinking",
  },
  {
    keys: ["hi", "hello", "hey", "sup", "yo"],
    text: "Hey. I'm shash. Ask me what he's built, what he's good at, or whether he's free — I'll tell you what I know.",
    mood: "happy",
  },
];

export const fallbackReply =
  "I only know what he's taught me — mostly the work. Try asking about his projects, the agent framework, the vision models, or whether he's open to something new.";

export type Mood =
  | "idle"
  | "thinking"
  | "speaking"
  | "happy"
  | "listening"
  | "bashful";
