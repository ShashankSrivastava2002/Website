import type { ReactNode } from "react";

/**
 * The briefs put emphasis on the load-bearing clause of nearly every point,
 * and flattening it would lose the thing that makes a wall of bullets
 * readable. This renders the three marks the copy actually uses — `**bold**`,
 * `*italic*` and `` `code` `` — and nothing else, so content.ts stays plain
 * text rather than becoming markup.
 */
export default function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<b key={k++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("`")) out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else out.push(<i key={k++}>{tok.slice(1, -1)}</i>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
