/**
 * Parse a bill's `fullText` into a structured reading model: a sequence of sections, where
 * each section has a heading and a list of paragraphs. If no headings are detected the entire
 * body becomes a single anonymous section, so the reader works even for unstructured prose.
 *
 * The detection patterns are conservative — they prefer false negatives (rendering as flowing
 * prose) over false positives (over-splitting normal sentences into headings).
 */

export interface ReaderSection {
  /** Stable slug for TOC anchor links. */
  id: string;
  /** The heading text as it appears, e.g. "PART I — Preliminary" or "Section 1". */
  heading: string;
  /** Short label used in the TOC: "I", "1", "Chapter 2". */
  label: string;
  /** Paragraphs of body prose under this heading. Each one is rendered as a <p>. */
  paragraphs: string[];
}

export interface ReaderDocument {
  sections: ReaderSection[];
  paragraphCount: number;
  wordCount: number;
  estimatedReadMinutes: number;
}

const HEADING_PATTERNS: { re: RegExp; label: (m: RegExpMatchArray) => string }[] = [
  { re: /^PART\s+([IVXLCDM]+|[A-Z]|\d+)\b\.?\s*(.*)$/i,    label: (m) => `Part ${m[1].toUpperCase()}` },
  { re: /^CHAPTER\s+([IVXLCDM]+|[A-Z]|\d+)\b\.?\s*(.*)$/i, label: (m) => `Chapter ${m[1].toUpperCase()}` },
  { re: /^SECTION\s+(\d+[A-Z]?)\b\.?\s*(.*)$/i,            label: (m) => `Section ${m[1]}` },
  { re: /^SCHEDULE\s+(\d+|[IVXLCDM]+|[A-Z])\b\.?\s*(.*)$/i, label: (m) => `Schedule ${m[1].toUpperCase()}` },
];

const WORDS_PER_MINUTE = 220;

export function parseBillText(fullText: string | null | undefined): ReaderDocument {
  const text = (fullText ?? '').trim();
  if (!text) {
    return { sections: [], paragraphCount: 0, wordCount: 0, estimatedReadMinutes: 0 };
  }

  // Normalise: collapse all internal whitespace runs, then split on blank lines.
  const rawBlocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 0);

  // If the source has no blank-line paragraph breaks, fall back to sentence-cluster heuristics:
  // group every 3 sentences into a paragraph. Keeps long PDF-extracted prose readable.
  const blocks = rawBlocks.length === 1 && rawBlocks[0].length > 600
    ? splitIntoParagraphs(rawBlocks[0])
    : rawBlocks;

  const sections: ReaderSection[] = [];
  let current: ReaderSection | null = null;
  let anonymousCounter = 0;

  for (const block of blocks) {
    const heading = detectHeading(block);
    if (heading) {
      // Push any previous open section.
      if (current) sections.push(current);
      current = {
        id: slugify(heading.label) + '-' + sections.length,
        heading: heading.full,
        label: heading.label,
        paragraphs: [],
      };
      // If the heading line carries trailing body content, push it as the first paragraph.
      if (heading.body) current.paragraphs.push(heading.body);
      continue;
    }
    if (!current) {
      anonymousCounter++;
      current = {
        id: `body-${anonymousCounter}`,
        heading: '',
        label: '',
        paragraphs: [],
      };
    }
    current.paragraphs.push(block);
  }
  if (current) sections.push(current);

  // Collapse a single-anonymous-section doc into a clean structure with empty heading.
  const paragraphCount = sections.reduce((n, s) => n + s.paragraphs.length, 0);
  const wordCount = sections.reduce(
    (n, s) => n + s.paragraphs.reduce((m, p) => m + countWords(p), 0),
    0,
  );

  return {
    sections,
    paragraphCount,
    wordCount,
    estimatedReadMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
  };
}

function detectHeading(block: string): { full: string; label: string; body: string } | null {
  for (const { re, label } of HEADING_PATTERNS) {
    const m = block.match(re);
    if (m) {
      const lbl = label(m);
      const rest = (m[2] ?? '').trim();
      const sep = rest ? ' — ' : '';
      return { full: `${lbl}${sep}${rest}`, label: lbl, body: '' };
    }
  }
  return null;
}

/**
 * Split a single big run of prose into ~3-sentence paragraphs for legibility. Used only when
 * the source text has no blank-line paragraph markers (common with naïve PDF extraction).
 */
function splitIntoParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) ?? [text];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join('').trim());
  }
  return paragraphs;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
