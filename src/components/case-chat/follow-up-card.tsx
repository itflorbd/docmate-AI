'use client';

import * as React from 'react';
import { MessageCircleQuestionIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import type { MissingInformation } from '@/types';

/** The single follow-up question for the latest reply, with one-tap answers. */
export function FollowUpCard({
  question,
  disabled,
  onAnswer,
}: {
  question: MissingInformation;
  disabled: boolean;
  onAnswer: (answer: string) => void;
}) {
  const t = useTranslations('chat');
  const [own, setOwn] = React.useState('');

  const submitOwn = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = own.trim();
    if (!answer) return;
    onAnswer(answer);
    setOwn('');
  };

  return (
    <Card size="sm" className="w-full max-w-xl">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <MessageCircleQuestionIcon aria-hidden />
          {t('followUpTitle')}
        </CardDescription>
        <CardTitle className="leading-snug">{question.text}</CardTitle>
        {question.why_it_helps && (
          <CardDescription>{t('followUpWhy', { reason: question.why_it_helps })}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form onSubmit={submitOwn}>
          <InputGroup>
            <InputGroupInput
              value={own}
              onChange={(event) => setOwn(event.target.value)}
              placeholder={t('ownAnswerPlaceholder')}
              aria-label={t('ownAnswerPlaceholder')}
              disabled={disabled}
              maxLength={4000}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" size="icon-xs" disabled={disabled || !own.trim()} aria-label={t('ownAnswerSend')}>
                <SendIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </CardContent>
    </Card>
  );
}
