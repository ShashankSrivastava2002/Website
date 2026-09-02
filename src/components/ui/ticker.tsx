import { work } from "@/content/site";

/**
 * The stack, scrolling along the bottom edge.
 *
 * The list is rendered TWICE and the track translates by exactly -50%, which is
 * what makes the loop seamless: at the moment the animation resets, the second
 * copy is sitting precisely where the first one started.
 */
export function Ticker() {
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {[...work.stack, ...work.stack].map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
    </div>
  );
}
