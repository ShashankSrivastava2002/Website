import { Mail, Github, Linkedin, FileText } from "lucide-react";
import { contact } from "@/content/site";

const ICONS = { mail: Mail, github: Github, linkedin: Linkedin, file: FileText };

export function Contact({ on }: { on: boolean }) {
  return (
    <section className="section" data-on={on} aria-hidden={!on}>
      <p className="mono eyebrow">GET IN TOUCH</p>
      <p className="lede">{contact.intro}</p>

      <div className="contact-grid">
        {contact.links.map((l) => {
          const Icon = ICONS[l.icon as keyof typeof ICONS] ?? Mail;
          return (
            <a
              className="link-row"
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
            >
              <Icon size={16} />
              <span>
                <span className="link-row-label">{l.label}</span>
                <br />
                <span className="link-row-value">{l.value}</span>
              </span>
            </a>
          );
        })}
      </div>

      <div className="career" style={{ marginTop: 28 }}>
        {contact.goodFor.map((g) => (
          <div className="career-row" key={g.key}>
            <span className="mono">{g.key}</span>
            <span>{g.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
