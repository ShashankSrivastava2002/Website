"use client";

import DecodingName from "@/components/decoding-name";

/**
 * Home is the name, the assistant and the figure.
 *
 * The chat dock and the figure are both fixed layers owned by the page, so
 * the only thing this component places is the hero — which fills the empty
 * top-left quarter the removed topbar left behind.
 */
export default function HomeSection({ start = true }: { start?: boolean }) {
  return (
    <div className="home">
      <DecodingName start={start} />
    </div>
  );
}
