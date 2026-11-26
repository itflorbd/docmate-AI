'use client';

import * as React from 'react';
import { RotateCcwIcon, SparklesIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { useVoice } from '@/context/VoiceContext';
import type { VoiceMessage } from '@/lib/voice/types';
import type { MissingInformation, PatientCase, SafetyAlert } from '@/types';
import { AssistantMessage, PendingAssistantMessage, toAssistantView } from './assistant-message';
import { ChatComposer, type ChatComposerHandle, type ReplyLanguage } from './chat-composer';
import { DoctorMessage } from './doctor-message';
import { SafetyAlerts, alertKey } from './safety-alerts';
import { useCaseChat, type ChatTurn } from './use-case-chat';

interface CaseChatProps {
  caseId: string;
  caseData: PatientCase;
  turns: ChatTurn[];
  onTurnsUpdate: (turns: ChatTurn[]) => void;
  onCaseUpdate: (updatedCase: PatientCase) => void;
}

function formatTime(value: unknown, locale: string): string {
  const date = new Date((value as string | number | Date | undefined) ?? Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale === 'bn' ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

function useAcknowledged(caseId: string) {
  const storageKey = `docmate_ack_${caseId}`;
  const [acknowledged, setAcknowledged] = React.useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const acknowledge = React.useCallback(
    (key: string) => {
      setAcknowledged((current) => {
        const next = new Set(current).add(key);
        try {
          sessionStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // storage unavailable
        }
        return next;
      });
    },
    [storageKey],
  );
  return { acknowledged, acknowledge };
}

/** Claude/ChatGPT-style case conversation backed by POST /api/cases/[id]/chat. */
export function CaseChat({ caseId, caseData, turns, onTurnsUpdate, onCaseUpdate }: CaseChatProps) {
  const locale = (useLocale() === 'en' ? 'en' : 'bn') as 'bn' | 'en';
  const t = useTranslations('chat');
  const { openVoicePanel, speakText, registerCaseVoiceHandler, isOpen: voiceOpen, privateMode } = useVoice();
  const voiceTurnRef = React.useRef(false);
  const [replyLanguage, setReplyLanguage] = React.useState<ReplyLanguage>('auto');
  const composerRef = React.useRef<ChatComposerHandle>(null);
  const { acknowledged, acknowledge } = useAcknowledged(caseId);
  const [feedback, setFeedback] = React.useState<Record<string, 'helpful' | 'unhelpful'>>({});

  const chat = useCaseChat({ caseId, turns, onTurnsUpdate, locale, replyLanguage });

  // While this case is open, spoken questions and dictation go through this
  // conversation, so voice answers use the patient record and verified sources.
  const { sendAndWait } = chat;
  React.useEffect(() => {
    registerCaseVoiceHandler(async (text, replyLocale) => {
      voiceTurnRef.current = true;
      const turn = await sendAndWait({ kind: 'observation', text, replyLanguage: replyLocale });
      if (!turn) return null;
      const content = (turn.content ?? {}) as Record<string, unknown>;
      const markdown = String(content.text ?? '').trim();
      const displayText = markdown.replace(/\s?\[\d+\]/g, '').trim();
      return {
        displayText,
        markdown,
        claims: (content.claims ?? []) as VoiceMessage['claims'],
        status: content.status as string | undefined,
        speechText: String(content.speech_text ?? displayText),
        abstained: content.status === 'insufficient_evidence',
      };
    });
    return () => registerCaseVoiceHandler(null);
  }, [registerCaseVoiceHandler, sendAndWait]);
  const visible = React.useMemo(
    () => turns.filter((turn) => !(turn.content as Record<string, unknown>)?.superseded),
    [turns],
  );
  const lastAssistantId = React.useMemo(
    () => [...visible].reverse().find((turn) => turn.role !== 'doctor')?.id,
    [visible],
  );
  const lastIsAssistant = visible.length > 0 && visible[visible.length - 1].role !== 'doctor';

  // With the voice panel open and read-aloud on, typed questions are answered
  // aloud too. Replies to spoken questions are read by the voice panel itself.
  const spokenTurnIds = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    const assistantIds = visible.filter((turn) => turn.role !== 'doctor').map((turn) => turn.id);
    if (spokenTurnIds.current === null) {
      spokenTurnIds.current = new Set(assistantIds); // never read old history on load
      return;
    }
    const fresh = visible.filter((turn) => turn.role !== 'doctor' && !spokenTurnIds.current!.has(turn.id));
    for (const turn of fresh) spokenTurnIds.current.add(turn.id);
    const latest = fresh.at(-1);
    if (!latest) return;
    if (voiceTurnRef.current) {
      voiceTurnRef.current = false;
      return;
    }
    if (!voiceOpen || privateMode) return;
    const content = (latest.content ?? {}) as Record<string, unknown>;
    const speech = String(content.speech_text ?? '').trim();
    const replyLocale = (content.language_metadata as { reply_language?: string } | undefined)?.reply_language === 'en' ? 'en' : 'bn';
    if (speech) void speakText(speech, undefined, { locale: replyLocale });
  }, [privateMode, speakText, visible, voiceOpen]);

  // Like a colleague who reads the chart first: once the case has a complaint,
  // DocMate reviews it without being asked (once per case and browser session).
  const complaint = caseData?.structured_input?.chief_complaint?.trim();
  const autoStarted = React.useRef(false);
  React.useEffect(() => {
    if (autoStarted.current || !complaint || visible.length > 0 || chat.busy) return;
    const key = `docmate_auto_review_${caseId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // storage unavailable: the ref still prevents repeats in this view
    }
    autoStarted.current = true;
    void chat.send({ kind: 'evidence_review', text: '', auto: true });
  }, [caseId, chat, complaint, visible.length]);

  const send = React.useCallback(
    (text: string) => chat.send({ kind: 'observation', text }),
    [chat],
  );

  const answerFollowUp = React.useCallback(
    (question: MissingInformation, answer: string) => {
      void chat.send({ kind: 'question_answer', text: answer, question: { id: question.id, text: question.text } });
    },
    [chat],
  );

  const decideUpdate = React.useCallback(
    async (turnId: string, updateId: string, action: 'confirm' | 'dismiss') => {
      const response = await fetch(`/api/cases/${caseId}/confirm-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: turnId, update_id: updateId, action }),
      });
      if (!response.ok) {
        toast.error(t('updateFailed'));
        return;
      }
      const data = await response.json();
      if (data.case) onCaseUpdate(data.case);
      await chat.refreshTurns();
      // When the last pending finding of this message is settled and at least
      // one was added, review the case again with the new information.
      const updates = ((data.turn?.content?.proposed_updates ?? []) as Array<{ status: string }>);
      const settled = updates.length > 0 && updates.every((update) => update.status !== 'pending');
      if (settled && updates.some((update) => update.status === 'confirmed')) {
        void chat.send({ kind: 'evidence_review', text: '', auto: true });
      }
    },
    [caseId, chat, onCaseUpdate, t],
  );

  const sendFeedback = React.useCallback(
    (turnId: string, rating: 'helpful' | 'unhelpful') => {
      setFeedback((current) => ({ ...current, [turnId]: rating }));
      void fetch('/api/assistant/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: turnId, rating, locale }),
      })
        .then((response) => {
          if (response.ok) toast.success(t('feedbackSaved'));
        })
        .catch(() => undefined);
    },
    [locale, t],
  );

  const pinnedAlerts = React.useMemo(() => {
    const byKey = new Map<string, SafetyAlert>();
    for (const turn of visible) {
      const alerts = ((turn.content as Record<string, unknown>)?.safety_alerts ?? []) as SafetyAlert[];
      for (const alert of alerts) {
        const key = alertKey(alert);
        if (alert.severity === 'critical' && !acknowledged.has(key)) byKey.set(key, alert);
      }
    }
    return [...byKey.values()];
  }, [acknowledged, visible]);

  const pending = chat.pending;
  const showOptimisticDoctor = pending && !pending.doctorSaved && !pending.input.regenerateOf && !pending.input.auto;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor" scrollPreviousItemPeek={48}>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label={t('transcriptLabel')}>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5 px-2 py-4 sm:px-4" aria-busy={chat.busy}>
              {visible.length === 0 && !pending && (
                <MessageScrollerItem messageId="empty">
                  <Empty className="border-0 my-auto py-12">
                    <EmptyHeader className="max-w-md mx-auto text-center space-y-2">
                      <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/10 text-primary mx-auto">
                        <SparklesIcon className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-bold text-foreground">{t('emptyTitle')}</EmptyTitle>
                      <EmptyDescription className="text-xs text-muted-foreground leading-relaxed">
                        {t('emptyDescription')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </MessageScrollerItem>
              )}

              {visible.map((turn) => {
                const content = (turn.content ?? {}) as Record<string, unknown>;
                const time = formatTime(turn.createdAt ?? turn.created_at, locale);

                if (content.type === 'case_event' || content.type === 'status_change') {
                  return (
                    <MessageScrollerItem key={turn.id} messageId={turn.id} className="flex justify-center">
                      <Badge variant="secondary">{String(content.description ?? content.note ?? '')}</Badge>
                    </MessageScrollerItem>
                  );
                }

                if (turn.role === 'doctor' && content.auto === true) {
                  return (
                    <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor className="flex justify-center">
                      <Badge variant="secondary" className="gap-1.5">
                        <SparklesIcon data-icon="inline-start" />
                        {t('autoReview')}
                      </Badge>
                    </MessageScrollerItem>
                  );
                }

                if (turn.role === 'doctor') {
                  const isAnswer = content.type === 'question_answer';
                  const text = String(isAnswer ? content.answer : (content.text ?? content.observation ?? content.note ?? ''));
                  return (
                    <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor>
                      <DoctorMessage
                        text={text}
                        question={isAnswer ? String(content.question ?? '') : undefined}
                        time={time}
                        edited={Boolean(content.edited_from)}
                        canEdit={!chat.busy && !isAnswer}
                        onEdit={(next) => void chat.send({ kind: 'observation', text: next, editOf: turn.id })}
                      />
                    </MessageScrollerItem>
                  );
                }

                const view = toAssistantView(turn.id, content, time);
                const isLatest = turn.id === lastAssistantId && lastIsAssistant;
                return (
                  <MessageScrollerItem key={turn.id} messageId={turn.id}>
                    <AssistantMessage
                      view={view}
                      locale={locale}
                      isLatest={isLatest}
                      busy={chat.busy}
                      followUpAnswered={false}
                      feedback={feedback[turn.id] ?? (content.feedback as 'helpful' | 'unhelpful' | undefined)}
                      acknowledged={acknowledged}
                      onAcknowledge={acknowledge}
                      onRegenerate={() => void chat.send({ kind: 'observation', text: '', regenerateOf: turn.id })}
                      onAnswerFollowUp={answerFollowUp}
                      onDecideUpdate={(updateId, action) => decideUpdate(turn.id, updateId, action)}
                      onReadAloud={(text) => void speakText(text)}
                      onFeedback={(rating) => sendFeedback(turn.id, rating)}
                    />
                  </MessageScrollerItem>
                );
              })}

              {showOptimisticDoctor && (
                <MessageScrollerItem messageId="pending-doctor" scrollAnchor>
                  <DoctorMessage
                    text={pending.input.kind === 'evidence_review' ? t('evidenceReview') : pending.doctorText}
                    question={pending.input.question?.text}
                    time={formatTime(undefined, locale)}
                    canEdit={false}
                    onEdit={() => undefined}
                  />
                </MessageScrollerItem>
              )}

              {pending && pending.status !== 'error' && (
                <MessageScrollerItem messageId="pending-assistant">
                  <PendingAssistantMessage trace={pending.trace} draft={pending.draft} safety={pending.safety} />
                </MessageScrollerItem>
              )}

              {pending?.status === 'error' && (
                <MessageScrollerItem messageId="pending-error">
                  <Alert variant="destructive">
                    <TriangleAlertIcon />
                    <AlertTitle>{pending.errorKind === 'send' ? t('sendFailed') : t('failed')}</AlertTitle>
                    <AlertAction className="flex gap-1">
                      {pending.errorKind === 'reply' && (
                        <Button size="sm" variant="outline" onClick={() => void chat.retry()}>
                          <RotateCcwIcon data-icon="inline-start" />
                          {t('retry')}
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label={t('editCancel')} onClick={chat.dismissError}>
                        <XIcon />
                      </Button>
                    </AlertAction>
                  </Alert>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label={t('jumpToLatest')} />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-2 sm:px-4">
        {pinnedAlerts.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="sr-only">{t('redFlagPinned')}</p>
            <SafetyAlerts alerts={pinnedAlerts} acknowledged={acknowledged} onAcknowledge={acknowledge} />
          </div>
        )}
        <ChatComposer
          ref={composerRef}
          caseId={caseId}
          busy={chat.busy}
          replyLanguage={replyLanguage}
          onReplyLanguageChange={setReplyLanguage}
          onSend={send}
          onEvidenceReview={() => void chat.send({ kind: 'evidence_review', text: '' })}
          onStop={chat.stop}
          onVoice={openVoicePanel}
        />
      </div>
    </div>
  );
}
