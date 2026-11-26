'use client';

import * as React from 'react';
import { CitationChip } from '@/components/shared/CitationChip';
import type { CitedClaim } from '@/lib/assistant/types';
import { cn } from '@/lib/utils';

/**
 * Small, safe Markdown renderer for assistant replies. It builds React
 * elements only (no HTML injection) and supports paragraphs, bullet and
 * numbered lists, block quotes, headings, bold, italics, inline code and
 * citation markers such as [1].
 */

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const last = blocks[blocks.length - 1];

    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const text = (bullet ?? numbered)![1];
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(text);
      else blocks.push({ kind: 'list', ordered, items: [text] });
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] });
    } else if (quote) {
      flush();
      if (last?.kind === 'quote') last.lines.push(quote[1]);
      else blocks.push({ kind: 'quote', lines: [quote[1]] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

// _italic_ only at word edges, so snake_case names stay as written.
const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|(?<![\p{L}\p{N}_])_[^_\s][^_]*?_(?![\p{L}\p{N}_])|\[\d{1,3}\])/gu;

function renderInline(text: string, claims: Map<number, CitedClaim>, draft: boolean, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <strong key={key} className="font-semibold">
          {renderInline(part.slice(2, -2), claims, draft, key)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const marker = part.match(/^\[(\d{1,3})\]$/);
    if (marker) {
      const ref = Number(marker[1]);
      const claim = claims.get(ref);
      if (claim && !draft) return <CitationChip key={key} index={ref} claim={claim} />;
      return (
        <sup key={key} className="text-muted-foreground">
          [{ref}]
        </sup>
      );
    }
    if (((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) && part.length > 2) {
      return <em key={key}>{renderInline(part.slice(1, -1), claims, draft, key)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function ChatMarkdown({
  text,
  claims = [],
  draft = false,
  className,
}: {
  text: string;
  claims?: CitedClaim[];
  draft?: boolean;
  className?: string;
}) {
  const claimMap = React.useMemo(() => new Map(claims.map((claim) => [claim.ref, claim])), [claims]);
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={cn('flex flex-col gap-3 leading-relaxed', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case 'heading':
            return (
              <p key={key} className="font-semibold text-foreground">
                {renderInline(block.text, claimMap, draft, key)}
              </p>
            );
          case 'quote':
            return (
              <blockquote key={key} className="flex flex-col gap-1 border-l-2 border-primary/40 pl-3 text-foreground/90">
                {block.lines.map((line, lineIndex) => (
                  <p key={`${key}-${lineIndex}`}>{renderInline(line, claimMap, draft, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag
                key={key}
                className={cn('flex flex-col gap-1.5 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="pl-1">
                    {renderInline(item, claimMap, draft, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ListTag>
            );
          }
          default:
            return <p key={key}>{renderInline(block.text, claimMap, draft, key)}</p>;
        }
      })}
    </div>
  );
}
