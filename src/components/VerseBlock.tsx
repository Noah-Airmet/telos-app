import type { Block, Highlight } from "../db/db";

interface VerseBlockProps {
  block: Block;
  highlights?: Highlight[];
  comparisonText?: string;
  showComparisonDiff?: boolean;
  onWordClick?: (payload: {
    word: string;
    blockId: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
  }) => void;
}

interface TextRange {
  start: number;
  end: number;
}

function tokenize(text: string) {
  return Array.from(text.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)).map((match) => ({
    normalized: match[0].toLowerCase(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function buildDiffRanges(baseText: string, comparisonText?: string): TextRange[] {
  if (!comparisonText || comparisonText === baseText) return [];

  const baseTokens = tokenize(baseText);
  const comparisonTokens = tokenize(comparisonText);

  if (!baseTokens.length || !comparisonTokens.length) {
    return baseTokens.map((token) => ({ start: token.start, end: token.end }));
  }

  const dp = Array.from({ length: baseTokens.length + 1 }, () =>
    Array.from({ length: comparisonTokens.length + 1 }, () => 0)
  );

  for (let i = baseTokens.length - 1; i >= 0; i -= 1) {
    for (let j = comparisonTokens.length - 1; j >= 0; j -= 1) {
      dp[i][j] = baseTokens[i].normalized === comparisonTokens[j].normalized
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const unchangedTokenIndexes = new Set<number>();
  let i = 0;
  let j = 0;

  while (i < baseTokens.length && j < comparisonTokens.length) {
    if (baseTokens[i].normalized === comparisonTokens[j].normalized) {
      unchangedTokenIndexes.add(i);
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const changedTokens = baseTokens.filter((_, index) => !unchangedTokenIndexes.has(index));
  if (!changedTokens.length) return [];

  const ranges: TextRange[] = [];

  for (const token of changedTokens) {
    const previousRange = ranges[ranges.length - 1];

    if (previousRange && token.start <= previousRange.end + 1) {
      previousRange.end = token.end;
      continue;
    }

    ranges.push({
      start: token.start,
      end: token.end,
    });
  }

  return ranges;
}

export function VerseBlock({
  block,
  highlights = [],
  comparisonText,
  showComparisonDiff = false,
  onWordClick,
}: VerseBlockProps) {
  if (block.type === "heading") {
    return (
      <h2 className="text-xl font-bold font-sans mt-8 mb-3">{block.text}</h2>
    );
  }

  if (block.type === "summary") {
    return (
      <p className="text-sm italic text-[var(--text-secondary)] mb-6 leading-relaxed">
        {block.text}
      </p>
    );
  }

  if (block.type === "commentary") {
    return (
      <blockquote className="border-l-2 border-[var(--text-secondary)] pl-4 my-4 text-[0.95rem] text-[var(--text-secondary)]">
        {block.text}
      </blockquote>
    );
  }

  const renderTextWithHighlights = () => {
    const diffRanges = showComparisonDiff ? buildDiffRanges(block.text, comparisonText) : [];
    const boundaries = new Set<number>([0, block.text.length]);
    const sortedHighlights = [...highlights].sort((a, b) => a.start_offset - b.start_offset);
    const tokens = block.tokens || [];
    const tokenIndex = new Map(tokens.map((token) => [`${token.start_offset}:${token.end_offset}`, token]));
    const nodes: React.ReactNode[] = [];

    for (const highlight of sortedHighlights) {
      boundaries.add(highlight.start_offset);
      boundaries.add(highlight.end_offset);
    }

    for (const diffRange of diffRanges) {
      boundaries.add(diffRange.start);
      boundaries.add(diffRange.end);
    }

    for (const token of tokens) {
      boundaries.add(token.start_offset);
      boundaries.add(token.end_offset);
    }

    const orderedBoundaries = [...boundaries].sort((a, b) => a - b);

    for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
      const start = orderedBoundaries[index];
      const end = orderedBoundaries[index + 1];
      const text = block.text.substring(start, end);

      if (!text) continue;

      const highlight = sortedHighlights.find(
        (item) => item.start_offset <= start && item.end_offset >= end
      );
      const hasDiff = diffRanges.some((range) => range.start <= start && range.end >= end);
      const token = tokenIndex.get(`${start}:${end}`);

      if (highlight) {
        nodes.push(
          <mark
            key={`segment-${start}-${end}`}
            style={{ backgroundColor: highlight.color }}
            className={`rounded-[2px] px-0.5 selection:bg-[var(--text-secondary)] selection:text-white ${
              hasDiff ? "ring-1 ring-amber-300/70 dark:ring-amber-500/60" : ""
            }`}
          >
            {text}
          </mark>
        );
        continue;
      }

      if (token && onWordClick) {
        nodes.push(
          <span
            key={`segment-${start}-${end}`}
            onClick={(event) => {
              event.stopPropagation();
              onWordClick({
                word: token.text,
                blockId: block.block_id,
                startOffset: token.start_offset,
                endOffset: token.end_offset,
                rect: event.currentTarget.getBoundingClientRect(),
              });
            }}
            className={`cursor-pointer rounded-[2px] px-0.5 transition-colors hover:bg-blue-100 dark:hover:bg-blue-500/20 ${
              hasDiff ? "bg-amber-200/60 dark:bg-amber-500/20" : ""
            }`}
          >
            {text}
          </span>
        );
        continue;
      }

      if (hasDiff) {
        nodes.push(
          <span
            key={`segment-${start}-${end}`}
            className="rounded-[2px] bg-amber-200/60 px-0.5 dark:bg-amber-500/20"
          >
            {text}
          </span>
        );
        continue;
      }

      nodes.push(<span key={`segment-${start}-${end}`}>{text}</span>);
    }

    return nodes;
  };

  const hasComparisonDiff = showComparisonDiff && buildDiffRanges(block.text, comparisonText).length > 0;

  // verse or paragraph
  return (
    <div
      className={`relative group verse-container ${hasComparisonDiff ? "rounded-md bg-amber-50/40 px-2 -mx-2 dark:bg-amber-500/5" : ""}`}
      data-block-id={block.block_id}
    >
      {block.number != null && (
        <span className="absolute -left-8 top-1 text-xs font-sans font-medium text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity select-none" contentEditable={false}>
          {block.number}
        </span>
      )}
      <p className="verse-text">
        {renderTextWithHighlights()}
      </p>
      {hasComparisonDiff && (
        <span className="mt-1 inline-flex rounded-full border border-amber-200 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/40 dark:text-amber-300">
          Diff
        </span>
      )}
    </div>
  );
}
