import { work } from "@/content/site";

export function Work({ on }: { on: boolean }) {
  return (
    <section className="section" data-on={on} aria-hidden={!on}>
      <p className="mono eyebrow">SELECTED WORK</p>
      <p className="lede work-copy">{work.intro}</p>

      <div className="career">
        {work.career.map((c) => (
          <div className="career-row" key={c.company}>
            <span className="mono">{c.period}</span>
            <strong>{c.company}</strong>
            <span>{c.title}</span>
          </div>
        ))}
      </div>

      <div className="work-grid">
        {work.projects.map((p) => (
          <article className="card" key={p.index}>
            <div className="card-top">
              <span className="mono">
                {p.index} · {p.kind}
              </span>
              <span className="card-stat">{p.stat}</span>
            </div>
            <h3>{p.title}</h3>
            <p>{p.blurb}</p>
            <div className="tags">
              {p.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
