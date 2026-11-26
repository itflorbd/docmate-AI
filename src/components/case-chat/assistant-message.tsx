'use client';

import * as React from 'react';
import {
  BotIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CitationChip } from '@/components/shared/CitationChip';
import type { CitedClaim } from '@/lib/assistant/types';
import type { ProposedUpdate } from '@/lib/clinical-extractor';
import type {
  MissingInformation,
  SafetyAlert,
  LabInterpretationResult,
  ClinicalScoreResult,
  ConsensusSummary,
  DecisionChip,
} from '@/types';
import { ClinicalDecisionCards } from '@/app/[locale]/cases/[id]/components/ClinicalDecisionCards';
import { AssistantTrace } from './assistant-trace';
import { ChatMarkdown } from './chat-markdown';
import { FollowUpCard } from './follow-up-card';
import { ProposedUpdates } from './proposed-updates';
import { SafetyAlerts } from './safety-alerts';
import type { TraceState } from './use-case-chat';

export interface AssistantView {
  id: string;
  text: string;
  status?: string;
  mode?: string;
  claims: CitedClaim[];
  followUp?: MissingInformation;
  missingInformation: string[];
  proposedUpdates: ProposedUpdate[];
  safetyAlerts: SafetyAlert[];
  speechText?: string;
  time: string;
  labInterpretation?: LabInterpretationResult;
  clinicalScores?: ClinicalScoreResult[];
  consensusSummary?: ConsensusSummary;
  decisionChips?: DecisionChip[];
}

export function toAssistantView(id: string, content: Record<string, unknown>, time: string): AssistantView {
  const rawClaims = (Array.isArray(content.claims) ? content.claims : Array.isArray(content.citations) ? content.citations : []) as CitedClaim[];
  const claims = rawClaims.map((claim, index) => ({ ...claim, ref: claim.ref ?? index + 1 }));
  const followUps = (Array.isArray(content.follow_ups) ? content.follow_ups : []) as MissingInformation[];
  return {
    id,
    text: String(content.text ?? ''),
    status: content.status as string | undefined,
    mode: content.mode as string | undefined,
    claims,
    followUp: followUps[0],
    missingInformation: (Array.isArray(content.missing_information) ? content.missing_information : []).filter(
      (item): item is string => typeof item === 'string',
    ),
    proposedUpdates: (Array.isArray(content.proposed_updates) ? content.proposed_updates : []) as ProposedUpdate[],
    safetyAlerts: (Array.isArray(content.safety_alerts) ? content.safety_alerts : []) as SafetyAlert[],
    speechText: content.speech_text as string | undefined,
    time,
    labInterpretation: content.lab_interpretation as LabInterpretationResult | undefined,
    clinicalScores: content.clinical_scores as ClinicalScoreResult[] | undefined,
    consensusSummary: content.consensus_summary as ConsensusSummary | undefined,
    decisionChips: content.decision_chips as DecisionChip[] | undefined,
  };
}

function ActionButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon-xs" variant={pressed ? 'secondary' : 'ghost'} aria-label={label} aria-pressed={pressed} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function DocMateAvatar() {
  return (
    <MessageAvatar>
      <Avatar size="sm">
        <AvatarFallback>
          <BotIcon aria-hidden />
        </AvatarFallback>
      </Avatar>
    </MessageAvatar>
  );
}

interface AssistantMessageProps {
  view: AssistantView;
  locale: 'bn' | 'en';
  isLatest: boolean;
  busy: boolean;
  followUpAnswered: boolean;
  feedback?: 'helpful' | 'unhelpful';
  acknowledged: Set<string>;
  onAcknowledge: (key: string) => void;
  onRegenerate: () => void;
  onAnswerFollowUp: (question: MissingInformation, answer: string) => void;
  onDecideUpdate: (updateId: string, action: 'confirm' | 'dismiss') => Promise<void>;
  onReadAloud: (text: string) => void;
  onFeedback: (rating: 'helpful' | 'unhelpful') => void;
}

export function AssistantMessage({
  view,
  locale,
  isLatest,
  busy,
  followUpAnswered,
  feedback,
  acknowledged,
  onAcknowledge,
  onRegenerate,
  onAnswerFollowUp,
  onDecideUpdate,
  onReadAloud,
  onFeedback,
}: AssistantMessageProps) {
  const t = useTranslations('chat');
  const [copied, setCopied] = React.useState(false);
  const insufficient = view.status === 'insufficient_evidence';
  const sources = React.useMemo(() => {
    const seen = new Set<string>();
    return view.claims.filter((claim) => {
      if (seen.has(claim.chunk_id + claim.quote)) return false;
      seen.add(claim.chunk_id + claim.quote);
      return true;
    });
  }, [view.claims]);
  const textHasMarkers = /\[\d{1,3}\]/.test(view.text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.text.replace(/\s?\[\d+\]/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <Message align="start">
      <DocMateAvatar />
      <MessageContent>
        <MessageHeader className="gap-2 px-0">
          <span className="font-semibold text-foreground">{t('assistantName')}</span>
          <time>{view.time}</time>
          {view.mode === 'library_excerpts' && (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" />}>
                <InfoIcon data-icon="inline-start" />
                {t('sources')}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{t('excerptMode')}</TooltipContent>
            </Tooltip>
          )}
        </MessageHeader>

        <SafetyAlerts alerts={view.safetyAlerts} acknowledged={acknowledged} onAcknowledge={onAcknowledge} />

        {view.status === 'stopped' && <p className="text-sm text-muted-foreground italic">{t('stopped')}</p>}
        {view.status === 'error' && (
          <Alert variant="destructive">
            <InfoIcon />
            <AlertTitle>{t('failed')}</AlertTitle>
          </Alert>
        )}

        {view.text && (
          <Bubble variant="ghost" className="max-w-full">
            <BubbleContent className="text-sm text-foreground">
              <ChatMarkdown text={view.text} claims={view.claims} />
            </BubbleContent>
          </Bubble>
        )}

        {insufficient && (
          <Alert>
            <InfoIcon />
            <AlertTitle>{t('insufficientTitle')}</AlertTitle>
            <AlertDescription>
              <p>{t('insufficientDescription')}</p>
              {view.missingInformation.length > 0 && (
                <>
                  <p className="font-medium text-foreground">{t('missingInfo')}</p>
                  <ul className="list-disc pl-5">
                    {view.missingInformation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{t('sources')}:</span>
            {sources.map((claim) => (
              <span key={`${claim.ref}-${claim.chunk_id}`} className="inline-flex max-w-full items-center gap-1">
                <CitationChip index={claim.ref} claim={claim} />
                {!textHasMarkers && <span className="truncate" title={claim.source_title}>{claim.source_title}</span>}
              </span>
            ))}
          </div>
        )}

        {view.proposedUpdates.length > 0 && (
          <ProposedUpdates updates={view.proposedUpdates} locale={locale} onDecide={onDecideUpdate} />
        )}

        <ClinicalDecisionCards
          labInterpretation={view.labInterpretation}
          clinicalScores={view.clinicalScores}
          consensusSummary={view.consensusSummary}
          decisionChips={view.decisionChips}
          locale={locale}
        />

        {isLatest && view.followUp && !followUpAnswered && (
          <FollowUpCard
            question={view.followUp}
            disabled={busy}
            onAnswer={(answer) => onAnswerFollowUp(view.followUp!, answer)}
          />
        )}

        {view.status !== 'error' && (
          <MessageFooter className="gap-0.5 px-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100 data-[latest=true]:sm:opacity-100" data-latest={isLatest}>
            {view.text && (
              <ActionButton label={copied ? t('copied') : t('copy')} onClick={() => void copy()}>
                {copied ? <CheckIcon /> : <CopyIcon />}
              </ActionButton>
            )}
            {view.text && (
              <ActionButton label={t('readAloud')} onClick={() => onReadAloud(view.speechText || view.text)}>
                <Volume2Icon />
              </ActionButton>
            )}
            {isLatest && !busy && (
              <ActionButton label={t('regenerate')} onClick={onRegenerate}>
                <RefreshCwIcon />
              </ActionButton>
            )}
            <ActionButton label={t('helpful')} pressed={feedback === 'helpful'} onClick={() => onFeedback('helpful')}>
              <ThumbsUpIcon />
            </ActionButton>
            <ActionButton label={t('notHelpful')} pressed={feedback === 'unhelpful'} onClick={() => onFeedback('unhelpful')}>
              <ThumbsDownIcon />
            </ActionButton>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

/** The in-flight assistant reply: live trace, safety alerts and the streamed draft. */
export function PendingAssistantMessage({
  trace,
  draft,
  safety,
}: {
  trace: TraceState;
  draft: string;
  safety: SafetyAlert[];
}) {
  const t = useTranslations('chat');
  return (
    <Message align="start">
      <DocMateAvatar />
      <MessageContent aria-busy="true">
        <MessageHeader className="px-0">
          <span className="font-semibold text-foreground">{t('assistantName')}</span>
        </MessageHeader>
        <SafetyAlerts alerts={safety} acknowledged={new Set()} />
        <AssistantTrace trace={trace} />
        {draft && (
          <Bubble variant="ghost" className="max-w-full">
            <BubbleContent className="text-sm text-muted-foreground">
              <ChatMarkdown text={draft} draft />
            </BubbleContent>
          </Bubble>
        )}
        {draft && <p className="text-xs text-muted-foreground">{t('draftNotice')}</p>}
      </MessageContent>
    </Message>
  );
}
