'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { updateUserPreferenceAction } from '@/lib/preferences';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isCompact: boolean;
  toggleTheme: () => void;
  toggleCompact: () => void;
  setPreferences: (theme: Theme, isCompact: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, initialTheme = 'dark', initialIsCompact = false }: { 
  children: React.ReactNode;
  initialTheme?: Theme;
  initialIsCompact?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [isCompact, setIsCompact] = useState(initialIsCompact);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (isCompact) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
  }, [theme, isCompact]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await updateUserPreferenceAction({ theme: newTheme });
  };

  const toggleCompact = async () => {
    const newCompact = !isCompact;
    setIsCompact(newCompact);
    await updateUserPreferenceAction({ isCompact: newCompact });
  };

  const setPreferences = (t: Theme, c: boolean) => {
    setTheme(t);
    setIsCompact(c);
  };

  return (
    <ThemeContext.Provider value={{ theme, isCompact, toggleTheme, toggleCompact, setPreferences }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
