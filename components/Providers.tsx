'use client';

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./ThemeProvider";
import { AppLoadingProvider } from "./AppBlockingLoader";

export default function Providers({ children, initialTheme = 'dark', initialIsCompact = false }: { 
  children: React.ReactNode,
  initialTheme?: any,
  initialIsCompact?: any
}) {
  return (
    <SessionProvider>
      <ThemeProvider initialTheme={initialTheme} initialIsCompact={initialIsCompact}>
        <AppLoadingProvider>
          {children}
        </AppLoadingProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
