"use client";

import { motion } from "framer-motion";
import { Github } from "lucide-react";
import { lab } from "@/lib/content";
import { EASE } from "@/lib/motion";
import MasterDetail, { Staggered, type MDItem } from "@/components/master-detail";
import RichText from "@/components/rich-text";
import Diagram from "@/components/diagrams";

/**
 * Personal projects, on the same master-detail model as Experience — the brief
 * asks the two to read as one system, so they run the same component.
 *
 * The rail item is the card face: name, hook, headline technologies, status.
 * Ordering is by strength, not date.
 */
export default function LabSection() {
  const items: MDItem[] = lab.projects.map((p) => ({
    id: p.id,
    label: p.name,
    rail: (
      <>
        <span className="pj-top">
          <span className="pj-index">{p.index}</span>
          <span className="pj-status">{p.status}</span>
        </span>
        <span className="md-tab-name">{p.name}</span>
        <span className="pj-hook">{p.hook}</span>
        <span className="pj-tech">
          {p.headline.map((t) => (
            <em key={t}>{t}</em>
          ))}
        </span>
      </>
    ),
    detail: (
      <>
        <header className="co-head">
          <h3>{p.name}</h3>
          <p className="co-meta">
            {p.status} · <code>{p.repoName}</code>
          </p>
        </header>

        <Staggered i={0}>
          <div className="area-head">
            <span className="area-index">01</span>
            <h4>Context</h4>
          </div>
          {p.diagram && <Diagram id={p.diagram} alt={p.diagramAlt} />}
          <p className="area-lead">
            <RichText text={p.context} />
          </p>
          {"framing" in p && p.framing && <p className="pj-framing">{p.framing}</p>}
        </Staggered>

        <Staggered i={1}>
          <div className="area-head">
            <span className="area-index">02</span>
            <h4>The hard part — {p.hardPart.title}</h4>
          </div>
          {p.hardPart.intro && <p className="area-lead">{p.hardPart.intro}</p>}
          <ul className="area-points">
            {p.hardPart.points.map((pt, i) => (
              <li key={i}>
                <RichText text={pt.text} />
              </li>
            ))}
          </ul>
        </Staggered>

        {"note" in p && p.note && (
          <Staggered i={2}>
            <aside className="pj-note" data-warn={"warn" in p.note && p.note.warn ? "true" : undefined}>
              <span className="pj-note-label">{p.note.label}</span>
              <p>
                <RichText text={String(p.note.text)} />
              </p>
            </aside>
          </Staggered>
        )}

        <Staggered i={4}>
          <div className="area-head">
            <span className="area-index">—</span>
            <h4>Stack</h4>
          </div>
          <div className="tagrow">
            {p.stack.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
          {/* Only rendered when a repo is actually public and safe to link.
              None are set yet: the brief flags a hardcoded API key in the
              converter's history, and the others have not been confirmed
              public. Add `repo` to the entry in content.ts to light this up. */}
          {(p as { repo?: string }).repo && (
            <div className="project-links">
              <a href={(p as { repo?: string }).repo} target="_blank" rel="noreferrer">
                <Github size={12} /> CODE
              </a>
            </div>
          )}
        </Staggered>
      </>
    ),
  }));

  return (
    <div className="page page--flush">
      <MasterDetail items={items} label="Projects" railHead="PROJECTS" />

      <motion.footer
        className="edu-strip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
      >
        <span className="edu-label">EARLIER</span>
        <span className="edu-row">{lab.earlier}</span>
      </motion.footer>
    </div>
  );
}
