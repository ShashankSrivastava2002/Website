import Link from "next/link";

export const metadata = {
  title: "Privacy — SHASH·AI",
  description: "What this site stores, in full. It is a short list.",
};

/**
 * Deliberately specific rather than boilerplate: every claim here was checked
 * against the source. If the storage keys or the contact flow change, this
 * page has to change with them.
 */
export default function Privacy() {
  return (
    <main className="doc">
      <div className="doc-inner">
        <Link className="doc-back" href="/">
          ← Back
        </Link>

        <p className="doc-eyebrow">PRIVACY</p>
        <h1>What this site stores</h1>
        <p className="doc-lede">
          No analytics, no trackers, no advertising, no cookies. Nothing you do
          here is sent anywhere or shared with anyone.
        </p>

        <h2>In your browser</h2>
        <p>
          Two values are kept on your own device so the site behaves sensibly
          when you come back. Neither leaves your browser and neither is
          readable by anyone else.
        </p>
        <ul className="doc-list">
          <li>
            <code>booted</code> — session storage. Records that you have already
            watched the start-up sequence, so it is skipped if you reload during
            the same session. Cleared when you close the tab.
          </li>
          <li>
            <code>seen</code> — local storage. Records that you have visited
            before, which changes the greeting on the home screen. It holds the
            value <code>1</code> and nothing else.
          </li>
        </ul>
        <p>
          Clearing site data in your browser removes both, and the site works
          exactly as it did the first time.
        </p>

        <h2>Getting in touch</h2>
        <p>
          There is no contact form. Every option on the contact page opens a
          message in your own mail client, addressed to me. Nothing is submitted
          to a server here, so nothing is stored here. Once you send that email
          it lives in your mail provider&apos;s systems and mine, under their
          policies.
        </p>

        <h2>Files</h2>
        <p>
          The CV is a static PDF served from this site. Downloading it is not
          logged or counted.
        </p>

        <h2>Hosting</h2>
        <p>
          Like any website, the server that delivers these pages may keep
          standard request logs — IP address, timestamp, and which file was
          requested. That is the hosting provider&apos;s doing, not the
          site&apos;s, and it is not used for anything.
        </p>

        <p className="doc-foot">
          Questions about any of this:{" "}
          <a href="mailto:srivastavashashank46@gmail.com">
            srivastavashashank46@gmail.com
          </a>
        </p>
      </div>
    </main>
  );
}
