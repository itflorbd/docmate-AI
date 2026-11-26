'use client';

import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { BookOpen, CheckCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CitationChipProps {
  index?: number;
  claim: {
    chunk_id: string;
    quote: string;
    text?: string;
    source_title?: string;
    source_year?: number;
    page?: number;
    section?: string;
    evidence_level?: string;
    verified?: boolean;
  };
  className?: string;
}

export function CitationChip({ index = 1, claim, className }: CitationChipProps) {
  const { openEvidence } = useEvidenceSheet();

  const isVerified = claim.verified !== false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEvidence({
      chunk_id: claim.chunk_id,
      quote: claim.quote,
      text: claim.text,
      source_title: claim.source_title,
      source_year: claim.source_year,
      page: claim.page,
      section: claim.section,
      evidence_level: claim.evidence_level,
    });
  };

  const triggerButton = (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold tracking-tight transition-all cursor-pointer',
        isVerified
          ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30'
          : 'bg-muted text-muted-foreground line-through opacity-60 border border-border',
        className
      )}
      title={isVerified ? 'Click to inspect source passage' : 'Unverified citation'}
    >
      <BookOpen className="w-3 h-3 shrink-0" />
      <span>[{index}]</span>
    </button>
  );

  return (
    <HoverCard>
      <HoverCardTrigger render={triggerButton} />
      <HoverCardContent
        align="start"
        className="w-80 p-3 text-xs space-y-2 shadow-lg border border-border bg-popover"
      >
        <div className="flex items-center justify-between text-muted-foreground font-medium pb-1 border-b border-border/60">
          <span className="truncate max-w-[190px] text-foreground font-semibold">
            {claim.source_title || 'Medical Guideline'}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold shrink-0">
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        </div>

        <p className="italic text-muted-foreground line-clamp-3 leading-relaxed">
          &ldquo;{claim.quote}&rdquo;
        </p>

        <div className="flex items-center justify-between pt-1 text-[11px] text-primary">
          <span>Click to view full passage</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
