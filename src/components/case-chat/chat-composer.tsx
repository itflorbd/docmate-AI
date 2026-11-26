'use client';

import * as React from 'react';
import { ArrowUpIcon, BookOpenIcon, MicIcon, SquareIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { transliterateBanglishToBangla } from '@/lib/language/phonetic';

export type ReplyLanguage = 'auto' | 'bn' | 'en';

export interface ChatComposerHandle {
  setText: (text: string) => void;
  focus: () => void;
}

interface ChatComposerProps {
  caseId: string;
  busy: boolean;
  replyLanguage: ReplyLanguage;
  onReplyLanguageChange: (value: ReplyLanguage) => void;
  onSend: (text: string) => Promise<boolean>;
  onEvidenceReview: () => void;
  onStop: () => void;
  onVoice: () => void;
}

const MAX_LENGTH = 4000;

function IconAction({
  label,
  children,
  ...props
}: React.ComponentProps<typeof InputGroupButton> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<InputGroupButton size="icon-sm" aria-label={label} {...props} />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export const ChatComposer = React.forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { caseId, busy, replyLanguage, onReplyLanguageChange, onSend, onEvidenceReview, onStop, onVoice },
  ref,
) {
  const t = useTranslations('chat');
  const storageKey = `docmate_draft_case_${caseId}`;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // The workspace renders this only on the client after the case loads.
  const [text, setText] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });
  const [phonetic, setPhonetic] = React.useState(false);

  const persist = React.useCallback(
    (value: string) => {
      try {
        if (value.trim()) sessionStorage.setItem(storageKey, value);
        else sessionStorage.removeItem(storageKey);
      } catch {
        // storage unavailable
      }
    },
    [storageKey],
  );

  React.useImperativeHandle(ref, () => ({
    setText: (value: string) => {
      setText(value);
      persist(value);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    focus: () => textareaRef.current?.focus(),
  }));

  // The visit-steps bar can prefill the composer (e.g. a vitals template).
  React.useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<{ caseId: string; text: string }>).detail;
      if (detail?.caseId !== caseId) return;
      setText(detail.text);
      persist(detail.text);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener('docmate:prefill', onPrefill);
    return () => window.removeEventListener('docmate:prefill', onPrefill);
  }, [caseId, persist]);

  // Auto-grow up to ~8 lines.
  React.useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [text]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    persist('');
    const ok = await onSend(value);
    if (!ok) {
      // Keep the doctor's words if sending failed.
      setText(value);
      persist(value);
    }
    textareaRef.current?.focus();
  };

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = event.target.value.slice(0, MAX_LENGTH);
    if (phonetic && value.endsWith(' ')) value = transliterateBanglishToBangla(value);
    setText(value);
    persist(value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape' && busy) {
      event.preventDefault();
      onStop();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <InputGroup className="rounded-2xl">
          <InputGroupTextarea
            ref={textareaRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            aria-label={t('inputLabel')}
            rows={1}
            maxLength={MAX_LENGTH}
            className="max-h-[200px] min-h-11 text-sm"
          />
          <InputGroupAddon align="block-end" className="justify-between gap-1">
            <div className="flex items-center gap-1">
              <IconAction label={t('speak')} onClick={onVoice}>
                <MicIcon />
              </IconAction>
              <IconAction label={t('evidenceReview')} onClick={onEvidenceReview} disabled={busy}>
                <BookOpenIcon />
              </IconAction>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Toggle
                      size="sm"
                      pressed={phonetic}
                      onPressedChange={setPhonetic}
                      aria-label={t('phoneticTyping')}
                    />
                  }
                >
                  ফ
                </TooltipTrigger>
                <TooltipContent>{t('phoneticTyping')}</TooltipContent>
              </Tooltip>
              <ToggleGroup
                size="sm"
                variant="outline"
                spacing={0}
                value={[replyLanguage]}
                onValueChange={(value) => {
                  const next = value[0] as ReplyLanguage | undefined;
                  if (next) onReplyLanguageChange(next);
                }}
                aria-label={t('replyLanguage')}
              >
                <ToggleGroupItem value="auto">{t('replyAuto')}</ToggleGroupItem>
                <ToggleGroupItem value="bn">বাংলা</ToggleGroupItem>
                <ToggleGroupItem value="en">EN</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {busy ? (
              <IconAction label={t('stop')} variant="default" className="rounded-full" onClick={onStop}>
                <SquareIcon />
              </IconAction>
            ) : (
              <IconAction label={t('send')} variant="default" className="rounded-full" type="submit" disabled={!text.trim()}>
                <ArrowUpIcon />
              </IconAction>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
      <p className="hidden items-center justify-start gap-1 px-2 text-[11px] text-muted-foreground sm:flex">
        <Kbd>Enter</Kbd> {t('keyboardHint')}
      </p>
    </div>
  );
});
