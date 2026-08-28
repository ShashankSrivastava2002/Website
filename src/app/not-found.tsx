import Link from "next/link";

export const metadata = {
  title: "404 — SHASH·AI",
};

/**
 * A dead end is still a page someone landed on. It keeps the site's voice
 * (the persona reports the fault the way it reports everything else) and
 * gives one clear way back rather than leaving the visitor stranded.
 */
export default function NotFound() {
  return (
    <main className="notfound">
      <div className="notfound-inner">
        <p className="notfound-code">ERR 404</p>
        <h1>That page isn&apos;t in the index.</h1>
        <p className="notfound-body">
          The link is either out of date or was never here. Everything the site
          knows about lives on the home page.
        </p>
        <Link className="notfound-back" href="/">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
