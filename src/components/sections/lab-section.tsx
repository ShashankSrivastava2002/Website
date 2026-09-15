"use client";

import { useState } from "react";
import { lab } from "@/lib/content";
import WorkCard from "@/components/work-card";
import CaseStudyDialog, {
  CsLead,
  CsNumbered,
  CsProse,
  CsSection,
  type CaseStudy,
} from "@/components/case-study";

/**
 * Lab: the projects as cards, each opening the same case study Experience
 * uses, so the two sections still read as one system. Ordered by strength,
 * not date.
 */

type Project = (typeof lab.projects)[number];
type Note = { label: string; text: string; warn?: boolean };

function study(p: Project): CaseStudy {
  const repo = (p as { repo?: string }).repo;
  const note = ("note" in p ? p.note : undefined) as Note | undefined;
  const framing = "framing" in p ? (p.framing as string | undefined) : undefined;

  return {
    pill: `PROJ_${p.id.toUpperCase()}`,
    title: p.name,
    meta: [p.status.charAt(0) + p.status.slice(1).toLowerCase(), p.repoName],
    diagram: p.diagram,
    diagramAlt: p.diagramAlt,
    glance: [
      ["Type", p.status.charAt(0) + p.status.slice(1).toLowerCase()],
      ["Repo", repo ? <a href={repo} target="_blank" rel="noreferrer"><code>{p.repoName}</code></a> : <code>{p.repoName}</code>],
      ["Built on", p.headline.join(" · ")],
    ],
    stack: p.stack,
    body: (
      <>
        <CsLead text={p.hook} />

        <CsSection n="01" label="Context">
          <CsProse text={p.context} />
        </CsSection>

        {framing && (
          <CsSection label="Framing" tone="callout">
            <CsProse text={framing} />
          </CsSection>
        )}

        <CsSection n="02" label="The hard part" tone="card">
          <h4 className="cs-subtitle">{p.hardPart.title}</h4>
          {p.hardPart.intro && <CsProse text={p.hardPart.intro} />}
          <CsNumbered items={p.hardPart.points} />
        </CsSection>

        {/* Warn notes are messages to the site owner, not to visitors — the
            converter's says a live API key is still in the repo's history.
            Rendering it publicly would point straight at the key. */}
        {note && !note.warn && (
          <CsSection label={note.label} tone="impact">
            <CsProse text={note.text} />
          </CsSection>
        )}
      </>
    ),
  };
}

const studies = lab.projects.map(study);

export default function LabSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  const count = String(lab.projects.length).padStart(2, "0");

  return (
    /* The same three zones as Experience, so moving between the two sections
       the figure does not jump: an index rail left, the figure in the middle,
       the cards right. The rail and the column share one active item —
       pointing at either lights both. */
    <div className="page page--flush page--split lab">
      <div className="md">
        <nav className="md-rail" aria-label="Project index">
          <div className="md-rail-head" aria-hidden>
            <span>INDEX</span>
            <b>{count}</b>
          </div>
          {lab.projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="md-tab"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setOpen(i)}
              aria-haspopup="dialog"
            >
              <span className="md-tab-period">{p.status}</span>
              <span className="md-tab-name">{p.name}</span>
              <span className="md-tab-role">{p.repoName}</span>
            </button>
          ))}
        </nav>

        <div className="md-detail scroll-col" tabIndex={0} aria-label="Projects">
          <div className="md-detail-inner">
            <div className="md-rail-head" aria-hidden>
              <span>PROJECTS</span>
              <b>{count}</b>
            </div>
            <div className="wgrid">
              {lab.projects.map((p, i) => (
                <WorkCard
                  key={p.id}
                  index={p.index}
                  kicker={p.status}
                  title={p.name}
                  body={p.hook}
                  chips={p.headline}
                  art={p.diagram}
                  active={i === active}
                  onActivate={() => setActive(i)}
                  onOpen={() => setOpen(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <CaseStudyDialog
        items={studies}
        open={open}
        section="lab"
        onClose={() => setOpen(null)}
        onStep={setOpen}
      />
    </div>
  );
}
