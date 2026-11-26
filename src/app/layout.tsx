import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { inter, notoSansBengali } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocMate AI - Clinical Decision Support Assistant',
  description: 'A clinical decision support demo with an internal evidence library.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${notoSansBengali.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
