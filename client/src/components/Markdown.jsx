/**
 * The smallest markdown renderer the AI layer's output needs.
 *
 * `bodyMd` from summarize/summarizeChapters is markdown, not plain text — the
 * fixtures were plain, so the screens rendered it with `whitespace-pre-wrap`
 * and the real API made "## The main idea" show up literally.
 *
 * Deliberately not a full parser: headings, bullets, paragraphs, bold, fenced
 * code, `code` spans and pipe tables are what the summary and study-guide
 * schemas produce. Anything else renders as its own text, which is the right
 * failure — visible, not broken.
 *
 * Code and tables arrived with the study guide: its application section is
 * asked for worked examples, formulas and code taken from the document, and a
 * `SELECT` reflowed into a paragraph is not a worked example. Code is also the
 * one place where the inline pass must NOT run — `**` inside a snippet is
 * operator syntax, not emphasis.
 */

/**
 * Splits on **bold** and `code`, so a partial `**` or a lone backtick stays
 * literal. One pass over both, because a term can be bold in one run and code
 * in the next and neither may swallow the other.
 */
const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      // eslint-disable-next-line react/no-array-index-key -- runs have no id
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        // eslint-disable-next-line react/no-array-index-key -- runs have no id
        <code key={index} className="rounded bg-tint-100 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-900">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });

/** A pipe table row, minus the outer pipes. `| a | b |` -> ['a', 'b']. */
const cells = (line) =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

/** The `| --- | --- |` line that marks the row above it as a header. */
const isTableDivider = (line) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');

export const Markdown = ({ source, className = '' }) => {
  if (!source) return null;

  const blocks = [];
  let paragraph = [];
  let bullets = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'p', lines: paragraph });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ kind: 'ul', lines: bullets });
    bullets = [];
  };

  const lines = String(source).split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const fence = /^\s*```(\w*)\s*$/.exec(line);

    // A fence swallows everything up to its closing pair verbatim. An unclosed
    // fence takes the rest of the block rather than leaking backticks into the
    // prose — a truncated generation should still show the code it did write.
    if (fence) {
      flushParagraph();
      flushBullets();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: 'code', language: fence[1], text: code.join('\n') });
      continue;
    }

    // A pipe row followed by a | --- | divider is a table; a pipe row on its
    // own is just a sentence that happens to contain a pipe.
    if (line.includes('|') && isTableDivider(lines[i + 1] ?? '')) {
      flushParagraph();
      flushBullets();
      const header = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(cells(lines[i]));
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
    } else if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) => {
        if (block.kind === 'h') {
          const size = block.level <= 2 ? 'text-lg' : 'text-base';
          return (
            // eslint-disable-next-line react/no-array-index-key -- blocks have no id
            <h3 key={index} className={`${size} font-bold text-ink-900`}>
              {inline(block.text)}
            </h3>
          );
        }
        if (block.kind === 'code') {
          return (
            // eslint-disable-next-line react/no-array-index-key -- blocks have no id
            <pre key={index} className="overflow-x-auto rounded-xl bg-navy-900 p-4 text-sm leading-relaxed text-white">
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.kind === 'table') {
          return (
            // eslint-disable-next-line react/no-array-index-key -- blocks have no id
            <div key={index} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-tint-200">
                    {block.header.map((cell, cellIndex) => (
                      // eslint-disable-next-line react/no-array-index-key -- cells have no id
                      <th key={cellIndex} className="py-2 pe-3 font-bold text-ink-900">{inline(cell)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    // eslint-disable-next-line react/no-array-index-key -- rows have no id
                    <tr key={rowIndex} className="border-b border-tint-200/60 last:border-0">
                      {row.map((cell, cellIndex) => (
                        // eslint-disable-next-line react/no-array-index-key -- cells have no id
                        <td key={cellIndex} className="py-2 pe-3 align-top">{inline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === 'ul') {
          return (
            // eslint-disable-next-line react/no-array-index-key -- blocks have no id
            <ul key={index} className="list-disc space-y-1.5 pl-5">
              {block.lines.map((item, itemIndex) => (
                // eslint-disable-next-line react/no-array-index-key -- items have no id
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          // eslint-disable-next-line react/no-array-index-key -- blocks have no id
          <p key={index}>{inline(block.lines.join(' '))}</p>
        );
      })}
    </div>
  );
};
