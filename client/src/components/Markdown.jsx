/**
 * The smallest markdown renderer the AI layer's output needs.
 *
 * `bodyMd` from summarize/summarizeChapters is markdown, not plain text — the
 * fixtures were plain, so the screens rendered it with `whitespace-pre-wrap`
 * and the real API made "## The main idea" show up literally.
 *
 * Deliberately not a full parser: headings, bullets, paragraphs and bold are
 * everything the summary schema produces. Anything else renders as its own
 * text, which is the right failure — visible, not broken.
 */

/** Splits on **bold** and returns the runs, so a partial `**` stays literal. */
const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      // eslint-disable-next-line react/no-array-index-key -- runs have no id
      <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );

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

  for (const rawLine of String(source).split('\n')) {
    const line = rawLine.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

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
            <h3 key={index} className={`${size} font-bold text-navy-900`}>
              {inline(block.text)}
            </h3>
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
