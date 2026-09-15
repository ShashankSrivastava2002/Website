"use client";

import {
  Activity,
  ArrowUpRight,
  Bot,
  Code2,
  Coins,
  Database,
  Network,
  Plug,
  ScanEye,
  ScanText,
  Scissors,
  Search,
  Shapes,
  ShieldAlert,
  Sparkles,
  Sprout,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import RichText from "@/components/rich-text";

/**
 * One item in a SELECTED WORK column, built to the reference's card: art on
 * the left, a mono kicker, the title, two clamped lines, a row of chips.
 *
 * Exactly one card in a column is `active` — solid, raised, in colour, with
 * the arrow. The rest sit back: translucent, faded, art in greyscale. Hover or
 * focus moves the active state, so the column reads as a list with a position
 * in it rather than a wall of equal boxes.
 */

/* The art. The reference uses commissioned line illustrations; stripped
   schematics were tried and read as empty placeholder boxes. A line icon
   printed twice — ink, and an accent plate knocked a few pixels out of
   register — is the closest honest equivalent. Keyed by the schematic id each
   item already carries, so content.ts needs nothing new. */
const ART: Record<string, LucideIcon> = {
  workflow: Workflow,
  gateway: Network,
  cost: Coins,
  observability: Activity,
  mcp: Plug,
  agents: Bot,
  documents: ScanText,
  retrieval: Search,
  nl2query: Database,
  vision: ScanEye,
  generative: Sparkles,
  attack: ShieldAlert,
  groot: Sprout,
  vae: Shapes,
  converter: Code2,
  separator: Scissors,
};

export type CardProps = {
  index: string;
  kicker: string;
  title: string;
  body: string;
  chips?: string[];
  art?: string;
  active: boolean;
  onActivate: () => void;
  onOpen: () => void;
};

export default function WorkCard({
  index,
  kicker,
  title,
  body,
  chips = [],
  art,
  active,
  onActivate,
  onOpen,
}: CardProps) {
  const Icon = (art && ART[art]) || Sparkles;

  return (
    <button
      type="button"
      className="wcard"
      data-active={active || undefined}
      onClick={onOpen}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      aria-haspopup="dialog"
    >
      <span className="wcard-art" aria-hidden>
        <span className="wcard-icon">
          <Icon className="wcard-plate" strokeWidth={1.4} />
          <Icon className="wcard-line" strokeWidth={1.4} />
        </span>
      </span>

      <span className="wcard-text">
        <span className="wcard-meta">
          <span className="wcard-kicker">
            {index} · {kicker}
          </span>
          <ArrowUpRight size={14} className="wcard-go" aria-hidden />
        </span>
        <span className="wcard-title">{title}</span>
        <span className="wcard-body">
          <RichText text={body} />
        </span>
        {chips.length > 0 && (
          <span className="wcard-chips">
            {chips.map((c) => (
              <span className="wcard-chip" key={c}>
                {c}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
