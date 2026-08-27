'use client';

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./ThemeProvider";
import { AppLoadingProvider } from "./AppBlockingLoader";
import { LanguageProvider } from "./LanguageProvider";
import type { Language } from "@/app/i18n/settings";

export default function Providers({ 
  children, 
  initialTheme = 'dark', 
  initialIsCompact = false,
  initialLanguage = 'pt',
}: { 
  children: React.ReactNode,
  initialTheme?: any,
  initialIsCompact?: any,
  initialLanguage?: Language
}) {
  return (
    <SessionProvider>
      <LanguageProvider initialLanguage={initialLanguage}>
        <ThemeProvider initialTheme={initialTheme} initialIsCompact={initialIsCompact}>
          <AppLoadingProvider>
            {children}
          </AppLoadingProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
