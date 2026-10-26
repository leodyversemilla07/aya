import { cn } from '@workspace/ui/lib/utils';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import '@workspace/ui/globals.css';
import { AppShell } from '@/components/app-shell';
import { ChatProvider } from '@/components/chat/chat-provider';
import { ThemeProvider } from '@/components/theme-provider';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'Aya — Staff Augmentation AI',
    template: '%s · Aya',
  },
  description:
    'Aya is an AI assistant for staff augmentation: find available developers, match skills to projects, track utilization, and monitor contracts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans antialiased', geist.variable, fontMono.variable)}
    >
      <body className="min-h-svh">
        <ThemeProvider>
          <ChatProvider>
            <AppShell>{children}</AppShell>
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
