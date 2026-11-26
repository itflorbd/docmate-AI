'use client';

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { BookOpen, CheckCircle, ShieldCheck, ExternalLink, FileText, AlertTriangle, Ban } from 'lucide-react';

interface ChunkExtraMeta {
  source_title?: string;
  source_year?: number;
  source_license?: string;
  source_doi?: string;
  source_url?: string;
  is_retired?: boolean;
  is_retracted?: boolean;
  storage_key?: string | null;
  file_mime?: string | null;
  heading_path?: string;
  page_start?: number;
  page_end?: number;
}

export function EvidenceSheet() {
  const { isOpen, activeEvidence, closeEvidence } = useEvidenceSheet();
  const [fullChunkText, setFullChunkText] = useState<string>('');
  const [extraMeta, setExtraMeta] = useState<ChunkExtraMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;

    if (!isOpen || !activeEvidence) {
      return;
    }

    if (activeEvidence.chunk_id) {
      fetch(`/api/library/chunks/${activeEvidence.chunk_id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.chunk) {
            if (data.chunk.text) {
              setFullChunkText(data.chunk.text);
            }
            setExtraMeta({
              source_title: data.chunk.source_title,
              source_year: data.chunk.source_year,
              source_license: data.chunk.source_license,
              source_doi: data.chunk.source_doi,
              source_url: data.chunk.source_url,
              is_retired: data.chunk.is_retired,
              is_retracted: data.chunk.is_retracted,
              storage_key: data.chunk.storage_key,
              file_mime: data.chunk.file_mime,
              heading_path: data.chunk.heading_path || data.chunk.headingPath,
              page_start: data.chunk.page_start || data.chunk.pageStart,
              page_end: data.chunk.page_end || data.chunk.pageEnd,
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [isOpen, activeEvidence]);

  if (!activeEvidence) return null;

  const quote = activeEvidence.quote || '';
  // Show the whole passage when it contains the quote, so a short quote (for
  // example a table cell) is read with its heading and surrounding text.
  const squash = (value: string) => value.replace(/\s+/g, ' ').trim();
  const fullContainsQuote = Boolean(fullChunkText && quote && squash(fullChunkText).includes(squash(quote)));
  const displayText = fullContainsQuote ? squash(fullChunkText!) : activeEvidence.text ? activeEvidence.text : (fullChunkText || quote);

  // Highlight quote within text if found
  let highlightedContent: React.ReactNode = displayText;
  if (quote && displayText && displayText.toLowerCase().includes(quote.toLowerCase())) {
    const lowerText = displayText.toLowerCase();
    const lowerQuote = quote.toLowerCase();
    const startIndex = lowerText.indexOf(lowerQuote);
    const endIndex = startIndex + quote.length;

    const before = displayText.slice(0, startIndex);
    const match = displayText.slice(startIndex, endIndex);
    const after = displayText.slice(endIndex);

    highlightedContent = (
      <span>
        {before}
        <mark className="bg-amber-200/80 dark:bg-amber-500/30 text-foreground px-1 py-0.5 rounded font-medium border-b border-amber-500">
          {match}
        </mark>
        {after}
      </span>
    );
  }

  const pageNum = extraMeta?.page_start || activeEvidence.page;
  const isRetired = extraMeta?.is_retired;
  const isRetracted = extraMeta?.is_retracted;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeEvidence()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col h-full max-h-screen overflow-hidden gap-0 bg-background"
      >
        <SheetHeader className="p-6 border-b border-border/60 bg-muted/20 shrink-0 pr-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Library Evidence Proof</span>
            </div>
            {isRetracted ? (
              <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                <Ban className="w-3 h-3" />
                Retracted Source
              </Badge>
            ) : isRetired ? (
              <Badge variant="secondary" className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="w-3 h-3" />
                Retired Source
              </Badge>
            ) : null}
          </div>

          <SheetTitle className="text-xl font-bold leading-snug">
            {extraMeta?.source_title || activeEvidence.source_title || 'Clinical Reference Source'}
          </SheetTitle>

          <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
            {(extraMeta?.source_year || activeEvidence.source_year) && (
              <span className="text-xs text-muted-foreground">Pub. {extraMeta?.source_year || activeEvidence.source_year}</span>
            )}
            {pageNum && (
              <span className="text-xs text-muted-foreground">• Page {pageNum}</span>
            )}
            {activeEvidence.evidence_level && (
              <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
                Level {activeEvidence.evidence_level}
              </Badge>
            )}
            {extraMeta?.source_license && (
              <Badge variant="secondary" className="text-[10px]">
                {extraMeta.source_license}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 overscroll-contain">
          {/* Status banner for retired or retracted citations */}
          {isRetracted && (
            <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
              <Ban className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Notice: Retracted Source.</strong> This reference source has been retracted by the publisher or withdrawn. It is preserved strictly for the audit record of this case consultation.
              </div>
            </div>
          )}

          {isRetired && !isRetracted && (
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Notice: Retired Source.</strong> This source has been retired or superseded by a newer version in the active library. This citation remains immutable for historical verification.
              </div>
            </div>
          )}

          {/* Verbatim quote callout */}
          {quote && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Verbatim Claim In Source
                </span>
                <span className="text-[10px] text-muted-foreground">ID: {activeEvidence.chunk_id.slice(0, 8)}</span>
              </div>
              <blockquote className="text-sm font-medium text-foreground italic border-l-2 border-primary pl-3 py-0.5">
                &ldquo;{quote}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Heading / Path breadcrumb */}
          {(extraMeta?.heading_path || activeEvidence.section) && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Heading Path / Section
              </h5>
              <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
                {extraMeta?.heading_path || activeEvidence.section}
              </p>
            </div>
          )}

          {/* Original Document / External Link Actions */}
          <div className="flex flex-wrap gap-2">
            {extraMeta?.storage_key && (
              <a
                href={`/api/admin/library/files/${extraMeta.storage_key}#page=${pageNum || 1}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                View Original Page ({pageNum ? `p. ${pageNum}` : 'Document'})
              </a>
            )}

            {extraMeta?.source_url && (
              <a
                href={extraMeta.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Canonical URL
              </a>
            )}

            {extraMeta?.source_doi && (
              <a
                href={`https://doi.org/${extraMeta.source_doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                DOI: {extraMeta.source_doi}
              </a>
            )}
          </div>

          {/* Full context passage */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Passage Context
            </h5>
            <div className="p-4 rounded-lg bg-card border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading passage...</div>
              ) : (
                highlightedContent
              )}
            </div>
          </div>
        </div>

        {/* Pinned Verification & Integrity Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            Verified by DocMate Code Engine
          </span>
          <span className="text-[10px] font-mono tracking-wider text-muted-foreground">Closed Medical Library</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
