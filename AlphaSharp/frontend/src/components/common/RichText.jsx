// Renders the small markdown subset used by AI and built-in answers:
// headings (# or a fully bold line), "- " / "1." lists, **bold**, _note_ and `code`.
// Text is rendered as React nodes; no HTML from the response is injected.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w])_[^_]+_(?![\w]))/g;
const LIST_ITEM = /^\s*([-*•]|\d+\.)\s+/;

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function blocks(text) {
  const out = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => { if (paragraph.length) out.push({ type: 'p', lines: paragraph }); paragraph = []; };
  const flushList = () => { if (list.length) out.push({ type: 'ul', lines: list }); list = []; };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (LIST_ITEM.test(line)) { flushParagraph(); list.push(line.replace(LIST_ITEM, '')); continue; }
    flushList();
    const heading = line.match(/^#{1,4}\s+(.*)$/) || line.match(/^\*\*([^*]+)\*\*(\s*\([^)]*\))?$/);
    if (heading) { flushParagraph(); out.push({ type: 'h', text: heading[1], aside: heading[2]?.trim() }); continue; }
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return out;
}

export default function RichText({ text, className = '' }) {
  return <div className={`rich-text ${className}`.trim()}>{blocks(text).map((block, index) => {
    if (block.type === 'h') return <h4 key={index}>{inline(block.text, index)}{block.aside && <span className="rich-aside"> {block.aside}</span>}</h4>;
    if (block.type === 'ul') return <ul key={index}>{block.lines.map((line, i) => <li key={i}>{inline(line, `${index}-${i}`)}</li>)}</ul>;
    return <p key={index}>{block.lines.map((line, i) => <span key={i}>{i > 0 && <br />}{inline(line, `${index}-${i}`)}</span>)}</p>;
  })}</div>;
}
