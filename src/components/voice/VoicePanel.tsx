'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MicIcon, SendIcon, Settings2Icon, SquareIcon, Volume2Icon, VolumeXIcon, XIcon } from 'lucide-react';
import { useVoice } from '@/context/VoiceContext';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ConversationLanguage } from '@/lib/voice/conversation';
import type { VoiceMessage } from '@/lib/voice/types';
import type { CitedClaim } from '@/lib/assistant/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatMarkdown } from '@/components/case-chat/chat-markdown';
import { DocMateAvatar } from './DocMateAvatar';

type StateKey = 'listening' | 'transcribing' | 'thinking' | 'speaking';

/** Animated level bars driven by the live microphone / speech amplitude. */
function LevelBars({ active, amplitude }: { active: boolean; amplitude: number }) {
  return (
    <span aria-hidden className="flex h-5 items-center gap-0.5">
      {[0.35, 0.7, 1, 0.6, 0.85, 0.45, 0.75].map((scale, index) => (
        <span
          key={index}
          className={cn('w-1 rounded-full bg-primary transition-all duration-100', active ? 'opacity-90' : 'opacity-25')}
          style={{ height: `${Math.max(3, (active ? amplitude * 20 : 3) * scale)}px` }}
        />
      ))}
    </span>
  );
}

function VoiceBubble({ message, onReplay, onCitation }: { message: VoiceMessage; onReplay: (text: string) => void; onCitation: (claim: NonNullable<VoiceMessage['citations']>[number]) => void }) {
  const t = useTranslations('voice');
  const locale = useLocale();
  const isDoctor = message.sender === 'doctor';
  const time = new Date(message.timestamp).toLocaleTimeString(locale === 'bn' ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const claims = (message.claims ?? []) as CitedClaim[];
  const richText = message.markdown && claims.length > 0;

  return (
    <Message align={isDoctor ? 'end' : 'start'}>
      <MessageContent>
        <Bubble align={isDoctor ? 'end' : 'start'} variant={isDoctor ? 'default' : 'muted'} className={isDoctor ? undefined : 'max-w-[92%]'}>
          <BubbleContent className="text-sm">
            {richText ? (
              <div lang={message.locale}>
                <ChatMarkdown text={message.text} claims={claims} />
              </div>
            ) : (
              <p lang={message.locale} className="leading-relaxed whitespace-pre-wrap">
                {message.text}
              </p>
            )}
          </BubbleContent>
        </Bubble>
        {!richText && Boolean(message.citations?.length) && (
          <div className="flex flex-wrap gap-1">
            {message.citations!.map((citation, index) => (
              <Button key={citation.chunk_id || index} size="xs" variant="outline" onClick={() => onCitation(citation)}>
                [{index + 1}] <span className="max-w-40 truncate" title={String((citation.source_title || 'Source') ?? '')}>{citation.source_title || 'Source'}</span>
              </Button>
            ))}
          </div>
        )}
        <MessageFooter className="gap-1 px-1">
          <time>{time}</time>
          {!isDoctor && (
            <Tooltip>
              <TooltipTrigger
                render={<Button size="icon-xs" variant="ghost" aria-label={t('replay')} onClick={() => onReplay(message.speakableText || message.text)} />}
              >
                <Volume2Icon />
              </TooltipTrigger>
              <TooltipContent>{t('replay')}</TooltipContent>
            </Tooltip>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

export function VoicePanel() {
  const locale = useLocale();
  const t = useTranslations('voice');
  const tChat = useTranslations('chat');
  const isMobile = useIsMobile();
  const { openEvidence } = useEvidenceSheet();
  const {
    isOpen,
    closeVoicePanel,
    state,
    amplitude,
    transcript,
    interimTranscript,
    messages,
    config,
    conversationLanguage,
    setConversationLanguage,
    microphoneLocale,
    privateMode,
    avatarVisible,
    errorText,
    startPushToTalk,
    stopPushToTalk,
    cancelPushToTalk,
    speakText,
    stopSpeech,
    submitTranscript,
    setPrivateMode,
    setAvatarVisible,
    setSpeechSpeed,
    clearMessages,
  } = useVoice();

  const [isPressing, setIsPressing] = useState(false);
  const [editedInput, setEditedInput] = useState('');

  useEffect(() => {
    if (transcript) queueMicrotask(() => setEditedInput(transcript));
  }, [transcript]);

  const busy = state === 'listening' || state === 'transcribing' || state === 'thinking';
  const readAloud = !privateMode;

  const handlePress = () => {
    if (state === 'speaking') {
      stopSpeech();
      return;
    }
    setIsPressing(true);
    void startPushToTalk();
  };

  const handleRelease = () => {
    if (!isPressing) return;
    setIsPressing(false);
    void stopPushToTalk();
  };

  const send = (text: string) => {
    if (!text.trim()) return;
    void submitTranscript(text);
    setEditedInput('');
  };

  const statusLabel = errorText
    ? errorText
    : state in { listening: 1, transcribing: 1, thinking: 1, speaking: 1 }
      ? t(state as StateKey)
      : t('statusReady');

  const starters = [tChat('starterTests'), tChat('starterRedFlags'), tChat('starterManagement')];

  const content = (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* Header: identity, live status, read-aloud switch, settings */}
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        {avatarVisible ? (
          <DocMateAvatar state={state} amplitude={amplitude} size="sm" className="shrink-0" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MicIcon />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold" title={String(config.persona_name ?? '')}>{config.persona_name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                errorText ? 'bg-destructive' : state === 'idle' ? 'bg-primary/60' : 'animate-pulse bg-primary',
              )}
            />
            <span className="truncate" title={String(statusLabel ?? '')}>{statusLabel}</span>
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Label className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted" />
            }
          >
            {readAloud ? <Volume2Icon className="size-4 text-primary" /> : <VolumeXIcon className="size-4 text-muted-foreground" />}
            <Switch checked={readAloud} onCheckedChange={(checked) => setPrivateMode(!checked)} aria-label={t('readAloud')} />
          </TooltipTrigger>
          <TooltipContent>{readAloud ? t('readAloudOn') : t('readAloudOff')}</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('settings')} />}>
            <Settings2Icon />
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-72 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="voice-avatar">{t('avatarToggle')}</Label>
              <Switch id="voice-avatar" checked={avatarVisible} onCheckedChange={setAvatarVisible} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('speechSpeed')}</span>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={[String(config.default_speed)]}
                onValueChange={(value) => value[0] && setSpeechSpeed(Number(value[0]))}
              >
                {[0.8, 1, 1.2].map((speed) => (
                  <ToggleGroupItem key={speed} value={String(speed)}>
                    {speed}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <p className="text-xs text-muted-foreground">{t('privateModeDesc')}</p>
            <Separator />
            <Button variant="ghost" size="sm" className="justify-start text-destructive" onClick={clearMessages}>
              {t('clearChat')}
            </Button>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon-sm" onClick={closeVoicePanel} aria-label={locale === 'bn' ? 'বন্ধ করুন' : 'Close'}>
          <XIcon />
        </Button>
      </header>

      {/* Transcript */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 px-4 py-4">
              {messages.length === 0 && !interimTranscript && (
                <MessageScrollerItem messageId="voice-empty">
                  <Empty className="border-0 p-4">
                    <EmptyHeader>
                      {avatarVisible && <DocMateAvatar state={state} amplitude={amplitude} size="md" className="mx-auto" />}
                      <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
                      <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className="flex w-full flex-col gap-2">
                      {starters.map((starter) => (
                        <Button
                          key={starter}
                          variant="outline"
                          size="sm"
                          className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                          onClick={() => send(starter)}
                        >
                          {starter}
                        </Button>
                      ))}
                    </EmptyContent>
                  </Empty>
                </MessageScrollerItem>
              )}

              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.sender === 'doctor'}>
                  <VoiceBubble
                    message={message}
                    onReplay={(text) => void speakText(text, undefined, { locale: message.locale ?? (locale === 'en' ? 'en' : 'bn') })}
                    onCitation={(citation) => openEvidence({ ...citation, quote: citation.quote ?? '' })}
                  />
                </MessageScrollerItem>
              ))}

              {(interimTranscript || state === 'transcribing') && (
                <MessageScrollerItem messageId="voice-interim">
                  <Message align="end">
                    <MessageContent>
                      <Bubble align="end" variant="tinted">
                        <BubbleContent className="text-sm italic">{interimTranscript || t('transcribing')}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}

              {state === 'thinking' && (
                <MessageScrollerItem messageId="voice-thinking">
                  <Message align="start">
                    <MessageContent>
                      <Badge variant="secondary" className="gap-2">
                        <LevelBars active amplitude={0.4} />
                        {t('thinking')}
                      </Badge>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Controls */}
      <footer className="flex shrink-0 flex-col gap-3 border-t bg-card px-4 py-3">
        <InputGroup>
          <InputGroupInput
            value={editedInput}
            onChange={(event) => setEditedInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) send(editedInput);
            }}
            placeholder={t('editPlaceholder')}
            aria-label={t('editPlaceholder')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" variant="default" onClick={() => send(editedInput)} disabled={!editedInput.trim()} aria-label={t('send')}>
              <SendIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <label className="flex items-center gap-2 text-xs font-medium">
              {t('conversationLanguage')}
              <select
                value={conversationLanguage}
                onChange={(event) => setConversationLanguage(event.currentTarget.value as ConversationLanguage)}
                disabled={isPressing || state === 'listening' || state === 'transcribing'}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="auto">{t('conversationAuto')}</option>
                <option value="bn" lang="bn">{t('conversationBangla')}</option>
                <option value="en" lang="en">{t('conversationEnglish')}</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground">
              {t(microphoneLocale === 'bn' ? 'conversationMicBangla' : 'conversationMicEnglish')}
            </span>
          </div>

          {/* Push-to-talk: hold to record, release to send. Tap while speaking to stop. */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                handlePress();
              }}
              onPointerUp={handleRelease}
              onPointerCancel={() => {
                setIsPressing(false);
                cancelPushToTalk();
              }}
              onKeyDown={(event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                event.preventDefault();
                if (!event.repeat) handlePress();
              }}
              onKeyUp={(event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                event.preventDefault();
                handleRelease();
              }}
              onBlur={() => {
                if (!isPressing) return;
                setIsPressing(false);
                cancelPushToTalk();
              }}
              disabled={state === 'thinking' || state === 'transcribing'}
              aria-label={state === 'speaking' ? t('tapToStop') : t('holdToSpeak')}
              className={cn(
                'relative flex size-16 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all select-none outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-60',
                state === 'listening' && 'scale-110 bg-destructive text-white ring-4 ring-destructive/30',
                state === 'speaking' && 'ring-4 ring-primary/30',
                state === 'idle' && 'hover:scale-105 active:scale-95',
              )}
            >
              {state === 'listening' && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />}
              {state === 'speaking' ? <SquareIcon className="size-6" /> : <MicIcon className="size-7" />}
            </button>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {(state === 'listening' || state === 'speaking') && <LevelBars active amplitude={amplitude} />}
              {state === 'speaking' ? t('stopHint') : state === 'listening' ? t('releaseHint') : busy ? statusLabel : t('holdHint')}
            </span>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">{t('generatedVoice')}</p>
      </footer>
    </div>
  );

  // Mobile: bottom drawer. Desktop: docked side panel that leaves the case visible.
  return (
    <>
      <div className="md:hidden">
        <Drawer open={isMobile && isOpen} onOpenChange={(open) => !open && closeVoicePanel()}>
          <DrawerContent className="flex h-[88vh] flex-col p-0">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{config.persona_name}</DrawerTitle>
              <DrawerDescription>{t('title')}</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col">{content}</div>
          </DrawerContent>
        </Drawer>
      </div>

      <aside
        aria-label={t('title')}
        className={cn(
          'fixed inset-y-0 right-0 z-50 hidden w-[420px] border-l bg-background shadow-2xl transition-transform duration-300 ease-out md:block',
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
      >
        {!isMobile && isOpen && content}
      </aside>
    </>
  );
}
