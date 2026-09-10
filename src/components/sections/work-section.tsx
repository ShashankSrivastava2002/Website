"use client";

import { motion } from "framer-motion";
import { work } from "@/lib/content";
import { EASE, STAGE } from "@/lib/motion";
import MasterDetail, { Staggered, type MDItem } from "@/components/master-detail";
import RichText from "@/components/rich-text";
import Diagram from "@/components/diagrams";

/**
 * Experience, company-wise.
 *
 * The six-card "Selected Work" grid that used to live here is gone: four of
 * those were InteligenAI work and now sit under that company, and the other
 * two are personal projects and moved to Lab. Nothing on the site describes
 * the same work twice.
 */
export default function WorkSection() {
  const items: MDItem[] = work.companies.map((c) => ({
    id: c.id,
    label: c.name,
    rail: (
      <>
        <span className="md-tab-name">{c.name}</span>
        <span className="md-tab-role">{c.role}</span>
        <span className="md-tab-period">{c.period}</span>
      </>
    ),
    detail: (
      <>
        <header className="co-head">
          <h3>{c.name}</h3>
          <p className="co-meta">
            {c.location} · {c.period}
          </p>
          <p className="co-context">{c.context}</p>
        </header>

        <div className="co-marks">
          {c.marks.map((m) => (
            <div className="co-mark" key={m.label}>
              <span className="co-mark-value">{m.value}</span>
              <span className="co-mark-label">{m.label}</span>
            </div>
          ))}
        </div>

        {c.areas.map((a, i) => (
          <Staggered i={i} key={a.index}>
            <div className="area-head">
              <span className="area-index">{a.index}</span>
              <h4>{a.title}</h4>
            </div>

            {"lead" in a && a.lead && (
              <p className="area-lead">
                <RichText text={a.lead} />
              </p>
            )}

            <ul className="area-points">
              {a.points.map((p, pi) => (
                <li key={pi}>
                  <RichText text={p.text} />
                  {"inferred" in p && p.inferred && (
                    <abbr className="inferred" title="Inferred from the nature of the work — confirm before relying on it">
                      †
                    </abbr>
                  )}
                </li>
              ))}
            </ul>

            {a.diagram && <Diagram id={a.diagram} alt={a.diagramAlt} />}
          </Staggered>
        ))}

        <Staggered i={c.areas.length}>
          <div className="area-head">
            <span className="area-index">—</span>
            <h4>Stack</h4>
          </div>
          <div className="tagrow">
            {c.stack.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        </Staggered>
      </>
    ),
  }));

  return (
    <div className="page">
      <SectionIntro index="02" label="EXPERIENCE" text={work.intro} />

      <MasterDetail items={items} label="Companies" />

      {/* One degree does not need a section, but it should not be hidden. */}
      <motion.footer
        className="edu-strip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
      >
        <span className="edu-label">EDUCATION</span>
        {work.education.map((e) => (
          <span className="edu-row" key={e.company}>
            <b>{e.company}</b> · {e.title} · {e.period}
          </span>
        ))}
      </motion.footer>
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

export function PanelHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="panel-head">
      <span>{title}</span>
      <b>{String(count).padStart(2, "0")}</b>
    </div>
  );
}
