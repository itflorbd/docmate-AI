import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EvidenceSheetProvider } from '@/context/EvidenceSheetContext';
import { TextSizeProvider } from '@/context/TextSizeContext';
import { VoiceProvider } from '@/context/VoiceContext';

export const metadata: Metadata = {
  title: 'DocMate AI - Clinical Decision Support Assistant',
  description: 'Synthetic clinical workspace and internal medical library demo.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NextIntlClientProvider messages={messages} locale={locale}>
        <TextSizeProvider>
          <TooltipProvider delay={200}>
            <EvidenceSheetProvider>
              <VoiceProvider>{children}</VoiceProvider>
            </EvidenceSheetProvider>
          </TooltipProvider>
        </TextSizeProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
