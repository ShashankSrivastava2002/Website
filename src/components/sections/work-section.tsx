"use client";

import { motion } from "framer-motion";
import { work } from "@/lib/content";

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const, delay: 0.06 * i },
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

          {work.projects.map((p, i) => (
            <motion.article
              key={p.index}
              className="project"
              initial="hidden"
              animate="show"
              custom={i + 1}
              variants={rise}
            >
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
            </motion.article>
          ))}
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
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
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
