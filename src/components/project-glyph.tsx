import type { ReactNode } from "react";

/**
 * A drawn mark for each project card.
 *
 * The reference gives every work card a 168px isometric illustration, and
 * that art is most of why their Work column reads as a portfolio rather than
 * a list. Commissioning six illustrations is not on the table, so these are
 * procedural instead: one geometric diagram per project *kind*, drawn from
 * the thing the project actually does — a graph for agent orchestration,
 * stacked sheets for document extraction, converging rays for retrieval.
 *
 * Stroke-only and `currentColor`, so the plate tints them from CSS.
 */
const GLYPHS: Record<string, ReactNode> = {
  /* orchestration: nodes that call each other, one of them planning */
  AGENTS: (
    <>
      <path d="M18 20 L38 15 M18 20 L30 40 M38 15 L46 38 M30 40 L46 38" />
      <circle cx="18" cy="20" r="5" />
      <circle cx="38" cy="15" r="3.5" />
      <circle cx="30" cy="40" r="3.5" />
      <circle cx="46" cy="38" r="3.5" />
      <circle cx="18" cy="20" r="2" fill="currentColor" stroke="none" />
    </>
  ),

  /* extraction: a stack of pages, the top one parsed into fields */
  DOCUMENTS: (
    <>
      <rect x="12" y="16" width="28" height="34" rx="2" />
      <rect x="18" y="11" width="28" height="34" rx="2" />
      <path d="M24 20 H40 M24 26 H40 M24 32 H34" />
      <rect x="24" y="36" width="9" height="5" rx="1" fill="currentColor" stroke="none" />
    </>
  ),

  /* retrieval: a corpus of points, the relevant few pulled toward the query */
  RETRIEVAL: (
    <>
      <circle cx="32" cy="32" r="6" />
      <path d="M32 26 L22 14 M38 32 L52 28 M30 38 L20 48" />
      <circle cx="22" cy="14" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="52" cy="28" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="48" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="46" cy="47" r="1.6" opacity="0.45" />
      <circle cx="14" cy="30" r="1.6" opacity="0.45" />
      <circle cx="40" cy="12" r="1.6" opacity="0.45" />
    </>
  ),

  /* translation: one shape of code rewritten as another */
  TOOLING: (
    <>
      <rect x="10" y="16" width="17" height="32" rx="2" />
      <rect x="37" y="16" width="17" height="32" rx="2" />
      <path d="M14 24 H23 M14 30 H21 M14 36 H23 M14 42 H19" />
      <path d="M41 24 H50 M41 30 H48 M41 36 H50 M41 42 H46" />
      <path d="M28 32 H36 M33 29 L36 32 L33 35" />
    </>
  ),

  /* detection: boxes found over a frame */
  VISION: (
    <>
      <rect x="10" y="14" width="44" height="36" rx="2" opacity="0.5" />
      <rect x="17" y="22" width="18" height="20" rx="1.5" />
      <rect x="38" y="29" width="12" height="13" rx="1.5" />
      <path d="M17 22 H21 M17 22 V26 M35 42 H31 M35 42 V38" />
      <circle cx="26" cy="30" r="2" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function ProjectGlyph({ kind }: { kind: string }) {
  const glyph = GLYPHS[kind];
  if (!glyph) return null;
  return (
    <svg
      className="project-glyph"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
