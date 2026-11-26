'use client';

import * as React from 'react';
import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function DoctorMessage({
  text,
  question,
  time,
  edited,
  canEdit,
  onEdit,
}: {
  text: string;
  question?: string;
  time: string;
  edited?: boolean;
  canEdit: boolean;
  onEdit: (text: string) => void;
}) {
  const t = useTranslations('chat');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);

  const save = () => {
    const value = draft.trim();
    if (!value) return;
    setEditing(false);
    if (value !== text.trim()) onEdit(value);
  };

  return (
    <Message align="end">
      <MessageContent>
        {question && (
          <MessageHeader className="justify-end">
            <span className="max-w-full truncate" title={question}>
              {t('answerTo', { question })}
            </span>
          </MessageHeader>
        )}
        {editing ? (
          <div className="flex w-full max-w-[80%] flex-col gap-2 self-end">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  save();
                } else if (event.key === 'Escape') {
                  setEditing(false);
                }
              }}
              aria-label={t('edit')}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('editCancel')}
              </Button>
              <Button size="sm" onClick={save} disabled={!draft.trim()}>
                {t('editSave')}
              </Button>
            </div>
          </div>
        ) : (
          <Bubble align="end">
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        )}
        <MessageFooter className="gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
          {edited && <span>{t('edited')}</span>}
          <time>{time}</time>
          {canEdit && !editing && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('edit')}
                    onClick={() => {
                      setDraft(text);
                      setEditing(true);
                    }}
                  />
                }
              >
                <PencilIcon />
              </TooltipTrigger>
              <TooltipContent>{t('edit')}</TooltipContent>
            </Tooltip>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
