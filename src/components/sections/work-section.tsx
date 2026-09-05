"use client";

import { motion } from "framer-motion";
import { work } from "@/lib/content";
import ProjectGlyph from "@/components/project-glyph";
import { EASE, STAGE, bodyDelay } from "@/lib/motion";

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: STAGE.duration, ease: EASE, delay: bodyDelay(i) },
  }),
};

export default function WorkSection() {
  return (
    <div className="page">
      <SectionIntro index="02" label="WORK" text={work.intro} />

      <div className="work-grid">
        {/* ------------------------- career ------------------------- */}
        <motion.div
          className="panel"
          initial="hidden"
          animate="show"
          custom={0}
          variants={rise}
        >
          <PanelHead title="CAREER" count={work.career.length} />
          <ul className="career">
            {work.career.map((c) => (
              <li key={c.company}>
                <span className="career-period">{c.period}</span>
                <span className="career-company">{c.company}</span>
                <span className="career-title">{c.title}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* ---------------------- selected work ---------------------- */}
        <div className="projects">
          <PanelHead title="SELECTED WORK" count={work.projects.length} />

          {/* The head above stays put; the cards scroll under it rather than
              pushing the page taller than the viewport. */}
          <div className="project-list scroll-col">
            {work.projects.map((p, i) => (
              <motion.article
                key={p.index}
                className="project"
                initial="hidden"
                animate="show"
                custom={i + 1}
                variants={rise}
              >
                {/* The plate carries the project's kind as a drawn mark —
                    see ProjectGlyph. Without it the column is six paragraphs
                    in a row and reads as a list rather than a portfolio. */}
                <div className="project-art" data-kind={p.kind}>
                  <ProjectGlyph kind={p.kind} />
                </div>

                <div className="project-body">
                  <header>
                    <span className="project-kind">
                      {p.index} · {p.kind}
                    </span>
                    <span className="project-stat">{p.stat}</span>
                  </header>
                  <h3>{p.title}</h3>
                  <p>{p.blurb}</p>
                  <div className="tagrow">
                    {p.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------- stack --------------------------- */}
      <div className="marquee" aria-label="Tools and technologies">
        <div className="marquee-label">
          STACK <b>{work.stack.length}</b>
        </div>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-row" key={dup} aria-hidden={dup === 1}>
              {work.stack.map((s) => (
                <span key={s + dup}>{s}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SectionIntro({
  index,
  label,
  text,
}: {
  index: string;
  label: string;
  text: string;
}) {
  return (
    <motion.header
      className="page-intro"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: STAGE.duration, ease: EASE, delay: STAGE.intro }}
    >
      <span className="page-index">
        {index} / {label}
      </span>
      <p>{text}</p>
    </motion.header>
  );
}

function PanelHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="panel-head">
      <span>{title}</span>
      <b>{String(count).padStart(2, "0")}</b>
    </div>
  );
}
