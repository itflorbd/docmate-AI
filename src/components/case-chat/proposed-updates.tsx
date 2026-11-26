'use client';

import * as React from 'react';
import { CheckIcon, ClipboardPlusIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import type { ProposedUpdate } from '@/lib/clinical-extractor';

/** Facts extracted from the doctor's message, waiting for confirmation. */
export function ProposedUpdates({
  updates,
  locale,
  onDecide,
}: {
  updates: ProposedUpdate[];
  locale: 'bn' | 'en';
  onDecide: (updateId: string, action: 'confirm' | 'dismiss') => Promise<void>;
}) {
  const t = useTranslations('chat');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const decide = async (updateId: string, action: 'confirm' | 'dismiss') => {
    setBusyId(updateId);
    try {
      await onDecide(updateId, action);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ClipboardPlusIcon aria-hidden className="size-3.5" />
        {t('proposedTitle')}
      </p>
      <ItemGroup className="gap-2">
        {updates.map((update) => (
          <Item key={update.id} variant="outline" size="sm" role="listitem">
            <ItemMedia variant="icon">
              <ClipboardPlusIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {locale === 'bn' ? update.label_bn : update.label_en}: {update.display_value}
              </ItemTitle>
              <ItemDescription>{t('proposedFrom', { text: update.original_wording })}</ItemDescription>
            </ItemContent>
            <ItemActions>
              {update.status === 'pending' ? (
                <>
                  <Button size="sm" disabled={busyId !== null} onClick={() => void decide(update.id, 'confirm')}>
                    {busyId === update.id ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                    {t('confirm')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => void decide(update.id, 'dismiss')}>
                    <XIcon data-icon="inline-start" />
                    {t('dismiss')}
                  </Button>
                </>
              ) : (
                <Badge variant={update.status === 'confirmed' ? 'default' : 'secondary'}>
                  {update.status === 'confirmed' ? t('confirmed') : t('dismissed')}
                </Badge>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
