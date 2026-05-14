'use client';

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./ThemeProvider";

export default function Providers({ children, initialTheme = 'light', initialIsCompact = false }: { 
  children: React.ReactNode,
  initialTheme?: any,
  initialIsCompact?: any
}) {
  return (
    <SessionProvider>
      <ThemeProvider initialTheme={initialTheme} initialIsCompact={initialIsCompact}>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
