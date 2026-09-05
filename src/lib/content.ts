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
  work: ["what has he built?", "tell me about the agent framework", "his biggest impact?"],
  about: ["who is he, really?", "where has he worked?", "what's he like to work with?"],
  contact: ["is he open to work?", "how fast does he reply?", "what should I send him?"],
};

export const sections = ["home", "work", "about", "contact"] as const;
export type Section = (typeof sections)[number];

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


export const work = {
  intro:
    "Two years of production AI, half a million documents, and systems running across three clouds — where I've been, and what I built.",
  career: [
    {
      period: "2026 — NOW",
      company: "Delhivery",
      title: "Software Engineer",
    },
    {
      period: "2024 — 2026",
      company: "InteligenAI · Spector.AI",
      title: "AI Developer",
    },
    {
      period: "2020 — 2024",
      company: "HBTU Kanpur",
      title: "B.Tech, Electronics & Communication",
    },
  ],
  projects: [
    {
      index: "01",
      kind: "AGENTS",
      stat: "MULTI-STEP",
      title: "MCP Agent Framework",
      blurb:
        "An orchestration layer built on LangGraph that lets agents plan, call tools, and recover from their own mistakes — multi-step reasoning that survives contact with real workloads.",
      tags: ["LANGGRAPH", "MCP", "PYTHON"],
    },
    {
      index: "02",
      kind: "DOCUMENTS",
      stat: "500K+",
      title: "Document Intelligence Pipeline",
      blurb:
        "Classification and extraction over half a million real documents — 99% classification accuracy, 90% extraction — turning unstructured paperwork into queryable structure.",
      tags: ["NLP", "OCR", "AZURE"],
    },
    {
      index: "03",
      kind: "RETRIEVAL",
      stat: "HYBRID",
      title: "RAG Chatbot",
      blurb:
        "Retrieval-augmented chat with hybrid dense and sparse search, so answers come back grounded in the source instead of confidently invented.",
      tags: ["RAG", "VECTOR SEARCH", "LLM"],
    },
    {
      index: "04",
      kind: "TOOLING",
      stat: "APR 2024",
      title: "Source Code Converter",
      blurb:
        "Translates a codebase between languages using prompt-engineered LLM passes, then scores its own output for accuracy — with a Streamlit surface for uploads and target specs.",
      tags: ["GENERATIVE AI", "PYTHON", "STREAMLIT"],
    },
    {
      index: "05",
      kind: "VISION",
      stat: "95%",
      title: "Custom Segmentation Model",
      blurb:
        "YOLOv8 for detection and boundary delineation, handed to SAM for precise semantic segmentation — 95% accuracy on custom classes.",
      tags: ["YOLOV8", "SAM", "DEEP LEARNING"],
    },
    {
      index: "06",
      kind: "VISION",
      stat: "BLEU",
      title: "Image Caption Generator",
      blurb:
        "VGG-16 feature extraction over a cleaned Flickr8K, fused with LSTM decoders to write captions — scored against human references with BLEU.",
      tags: ["LSTM", "VGG-16", "COMPUTER VISION"],
    },
  ],
  stack: [
    "PYTHON", "LANGGRAPH", "MCP", "PYTORCH", "TENSORFLOW", "HUGGING FACE",
    "OPENAI", "ANTHROPIC", "GEMINI", "YOLO", "SAM", "OPENCV",
    "FASTAPI", "STREAMLIT", "POSTGRES", "PGVECTOR", "REDIS", "DOCKER",
    "KUBERNETES", "AWS", "AZURE", "GCP", "NEXT.JS", "TYPESCRIPT",
  ],
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
