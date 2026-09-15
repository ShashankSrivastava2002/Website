"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { work } from "@/lib/content";
import { EASE, STAGE } from "@/lib/motion";
import MasterDetail, { type MDItem } from "@/components/master-detail";
import WorkCard from "@/components/work-card";
import CaseStudyDialog, {
  CsChips,
  CsLead,
  CsNumbered,
  CsSection,
  type CaseStudy,
} from "@/components/case-study";

/**
 * Experience, laid out the way the reference lays out Work: the career rail on
 * the left, the figure standing in the open middle, and one column of cards on
 * the right. The rail picks a company; a card opens its case study.
 *
 * This used to be the whole of every area written out down one column —
 * heading, schematic, a run of bullets, eleven times — which is what made it
 * read as documentation. The cards are the summary layer that was missing;
 * the depth is still all here, one click in, and laid out with rhythm.
 */

type Company = (typeof work.companies)[number];
type Area = Company["areas"][number];
type Point = { text: string; inferred?: boolean };

/** Two-line card body: the lead when it is a real sentence, else the first point. */
function summary(a: Area) {
  const lead = "lead" in a ? a.lead : undefined;
  return lead && lead.length >= 40 ? lead : a.points[0]?.text ?? "";
}

/**
 * The phrases the copy already bolds — the author's own emphasis — lifted into
 * a highlights row. Nothing is written here; it is extracted.
 */
function highlights(points: Point[]) {
  const out: string[] = [];
  // exec loop rather than matchAll: the tsconfig target predates iterating it.
  const re = /\*\*([^*]+)\*\*/g;
  for (const p of points) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(p.text))) {
      const t = m[1].replace(/[`*]/g, "").replace(/\.$/, "").trim();
      if (t.length > 3 && t.length <= 96 && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, 5);
}

/**
 * The company stack filtered down to what this area actually mentions, so the
 * chips are about the work on the card rather than the whole employer.
 * Bounded on both sides — SAM must not match "same", which the generative
 * area's copy uses — and version suffixes are dropped, so YOLOV8 still
 * matches "YOLO".
 */
function stackFor(text: string, stack: readonly string[]) {
  const hay = text.toLowerCase();
  const generic = new Set(["custom", "model"]);
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stack.filter((entry) =>
    entry.split("/").some((part) => {
      const phrase = part.trim().toLowerCase().replace(/\s*v?\d+(\.\d+)?$/, "");
      if (!phrase) return false;
      const first = phrase.split(/\s+/)[0];
      const words = [phrase, ...(first.length >= 4 && !generic.has(first) ? [first] : [])];
      return words.some((w) => new RegExp(`\\b${esc(w)}\\b`, "i").test(hay));
    })
  );
}

function study(c: Company, a: Area): CaseStudy {
  const lead = "lead" in a ? a.lead : undefined;
  const longLead = lead && lead.length >= 40 ? lead : undefined;
  const points = a.points as Point[];
  // With no real lead, the first point is the definition of the thing — it
  // becomes the opening sentence and the list carries the rest.
  const opening = longLead ?? points[0]?.text ?? "";
  const listed = longLead ? points : points.slice(1);
  const hl = highlights(listed);
  const text = [lead ?? "", ...points.map((p) => p.text)].join(" ");

  return {
    pill: `${c.id.toUpperCase()}_${a.index}`,
    // A lead too short to be a sentence ("The flagship.") is a label, so it
    // is shown as one.
    badge: lead && !longLead ? lead.replace(/\.$/, "") : undefined,
    title: a.title,
    meta: [c.name, c.role, c.period],
    diagram: a.diagram,
    diagramAlt: a.diagramAlt,
    glance: [
      ["Company", c.name],
      ["Role", c.role],
      ["Period", c.period],
      ["Location", c.location],
    ],
    stack: stackFor(text, c.stack),
    body: (
      <>
        <CsLead text={opening} />
        {hl.length > 0 && (
          <CsSection label="Highlights" tone="callout">
            <CsChips items={hl} />
          </CsSection>
        )}
        {listed.length > 0 && (
          <CsSection n="01" label="What was built" tone="card">
            <CsNumbered items={listed} />
          </CsSection>
        )}
        {listed.some((p) => p.inferred) && (
          <p className="cs-foot">† Inferred from the nature of the work — confirm before relying on it.</p>
        )}
      </>
    ),
  };
}

export default function WorkSection() {
  const [companyId, setCompanyId] = useState(work.companies[0].id);
  const [open, setOpen] = useState<number | null>(null);
  // The column always has exactly one active card; a new company starts at its first.
  const [active, setActive] = useState(0);

  const pickCompany = (id: string) => {
    setCompanyId(id);
    setActive(0);
  };

  const company = work.companies.find((c) => c.id === companyId) ?? work.companies[0];
  const studies = useMemo(() => company.areas.map((a) => study(company, a)), [company]);

  const items: MDItem[] = work.companies.map((c) => ({
    id: c.id,
    label: c.name,
    rail: (
      <>
        <span className="md-tab-period">{c.period}</span>
        <span className="md-tab-name">{c.name}</span>
        <span className="md-tab-role">{c.role}</span>
      </>
    ),
    detail: (
      <>
        <div className="md-rail-head" aria-hidden>
          <span>SELECTED WORK</span>
          <b>{String(c.areas.length).padStart(2, "0")}</b>
        </div>
        <div className="wgrid">
          {c.areas.map((a, i) => (
            <WorkCard
              key={a.index}
              index={a.index}
              kicker={c.name}
              title={a.title}
              body={summary(a)}
              chips={stackFor([("lead" in a ? a.lead : "") ?? "", ...a.points.map((p) => p.text)].join(" "), c.stack).slice(0, 3)}
              art={a.diagram}
              active={i === active}
              onActivate={() => setActive(i)}
              onOpen={() => setOpen(i)}
            />
          ))}
        </div>
      </>
    ),
  }));

  return (
    /* page--split: rail left, the figure standing in the open middle, one
       column of cards right — the reference's three zones. */
    <div className="page page--flush page--split">
      <MasterDetail items={items} label="Companies" railHead="CAREER" onChange={pickCompany} />
      <CaseStudyDialog
        items={studies}
        open={open}
        section="work"
        onClose={() => setOpen(null)}
        onStep={setOpen}
      />
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
