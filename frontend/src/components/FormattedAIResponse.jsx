import React, { useMemo } from "react";

const HEADING_RE = /^(Summary|Top Issues|Spending Breakdown|Action Plan|Priority|Steps):\s*$/i;
const BULLET_RE = /^(\*|-|•|\u2022)\s+/;

function cleanLine(raw) {
  return String(raw || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .trim();
}

function stripBullet(raw) {
  return cleanLine(raw).replace(BULLET_RE, "").trim();
}

function parseStructured(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine);

  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (current && (current.items.length || current.paragraphs.length)) sections.push(current);
  };

  for (const line of lines) {
    if (!line) continue;

    if (HEADING_RE.test(line)) {
      pushCurrent();
      current = { heading: line.replace(/:$/, ":"), items: [], paragraphs: [] };
      continue;
    }

    if (!current) current = { heading: "", items: [], paragraphs: [] };

    if (BULLET_RE.test(line)) current.items.push(stripBullet(line));
    else current.paragraphs.push(line);
  }

  pushCurrent();

  // If no headings detected, fallback: treat as a single paragraph block.
  if (!sections.length) {
    return [{ heading: "", items: [], paragraphs: lines.filter(Boolean) }];
  }

  return sections;
}

export default function FormattedAIResponse({ text }) {
  const sections = useMemo(() => parseStructured(text), [text]);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {sections.map((sec, idx) => (
        <div key={idx} className="space-y-2">
          {sec.heading ? (
            <div className="text-xs font-semibold tracking-wide text-gray-900 dark:text-white">
              {sec.heading.replace(/:$/, "")}
            </div>
          ) : null}

          {sec.paragraphs.length ? (
            <div className="space-y-2 text-gray-800 dark:text-[#C9D1E3]">
              {sec.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}

          {sec.items.length ? (
            <ul className="space-y-1.5 pl-4 text-gray-800 dark:text-[#C9D1E3]" style={{ listStyleType: "disc" }}>
              {sec.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

