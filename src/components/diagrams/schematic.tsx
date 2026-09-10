"use client";

import { useMemo, type ReactNode } from "react";

/**
 * The shared drawing surface for every schematic on Work and Lab.
 *
 * The briefs are explicit that these are mechanisms, not decoration — each one
 * has to show something a reader could redraw on a whiteboard. Keeping the
 * primitives here rather than hand-rolling each SVG is what makes sixteen of
 * them read as one system instead of sixteen illustrations.
 *
 * Edges carry `pathLength="1"`, so a single keyframe draws any path regardless
 * of its real length — see .dgm-draw in globals.css.
 */

/** Diagrams draw themselves once. A second visit renders the finished state. */
const drawn = new Set<string>();

export function Schematic({
  id,
  alt,
  width,
  height,
  children,
}: {
  id: string;
  alt: string;
  width: number;
  height: number;
  children: ReactNode;
}) {
  // useMemo, not useEffect: the decision has to be made during the first
  // render or the animation class lands a frame late and the draw is skipped.
  const first = useMemo(() => {
    if (drawn.has(id)) return false;
    drawn.add(id);
    return true;
  }, [id]);

  return (
    <figure className="dgm">
      <svg
        className={first ? "dgm-svg dgm-draw" : "dgm-svg"}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={alt}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{alt}</title>
        <defs>
          <marker
            id="dgm-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L8 4 L0 8 z" className="dgm-arrowhead" />
          </marker>
        </defs>
        {children}
      </svg>
    </figure>
  );
}

/** A box with a label, and optionally a smaller second line. */
export function Node({
  x,
  y,
  w = 112,
  h = 38,
  label,
  sub,
  accent,
  muted,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const cls = accent ? "dgm-node dgm-node--accent" : muted ? "dgm-node dgm-node--muted" : "dgm-node";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="7" className={cls} />
      <text x={cx} y={sub ? cy - 2 : cy + 3.5} className="dgm-text" textAnchor="middle">
        {label}
      </text>
      {sub && (
        <text x={cx} y={cy + 10} className="dgm-sub" textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

/** A circular node, for loop points and junctions. */
export function Dot({
  cx,
  cy,
  r = 20,
  label,
  accent,
}: {
  cx: number;
  cy: number;
  r?: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={accent ? "dgm-node dgm-node--accent" : "dgm-node"} />
      <text x={cx} y={cy + 3.5} className="dgm-text" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/** A connector. `d` is any path; the arrowhead is added unless `plain`. */
export function Edge({
  d,
  dashed,
  accent,
  plain,
}: {
  d: string;
  dashed?: boolean;
  accent?: boolean;
  plain?: boolean;
}) {
  const cls = ["dgm-edge", dashed && "dgm-edge--dashed", accent && "dgm-edge--accent"]
    .filter(Boolean)
    .join(" ");
  return <path d={d} className={cls} pathLength={1} markerEnd={plain ? undefined : "url(#dgm-arrow)"} />;
}

/** Free-standing text: edge captions, group headings, callouts. */
export function Label({
  x,
  y,
  children,
  accent,
  anchor = "middle",
  heading,
}: {
  x: number;
  y: number;
  children: ReactNode;
  accent?: boolean;
  anchor?: "start" | "middle" | "end";
  heading?: boolean;
}) {
  const cls = heading ? "dgm-heading" : accent ? "dgm-cap dgm-cap--accent" : "dgm-cap";
  return (
    <text x={x} y={y} className={cls} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** A dashed enclosure around a group of nodes. */
export function Group({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" className="dgm-group" />
      {label && (
        <text x={x + 10} y={y + 14} className="dgm-heading" textAnchor="start">
          {label}
        </text>
      )}
    </g>
  );
}
