'use client';

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Maximize, Minimize } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, isCompact, toggleTheme, toggleCompact } = useTheme();

  if (!session?.user) return null;

  const role = session.user.role;
  const isAdmin = session.user.isAdmin;

  const isAE = role === 'AE';
  const isSC = role === 'SC';

  return (
    <div className="hidden md:flex items-center space-x-8">
      <div className="flex items-center space-x-8 mr-8 border-r border-slate-200 pr-8">
        {(isSC || isAdmin) && (
          <Link 
            href="/sc" 
            className={`text-[10px] font-black uppercase tracking-widest transition-all ${
              pathname.startsWith('/sc') ? 'text-brand-primary' : 'text-slate-400 hover:text-brand-dark'
            }`}
          >
            Projetos
          </Link>
        )}
        
        {(isAE || isSC || isAdmin) && (
          <Link 
            href="/ae/history" 
            className={`text-[10px] font-black uppercase tracking-widest transition-all ${
              pathname.startsWith('/ae/history') ? 'text-brand-primary' : 'text-slate-400 hover:text-brand-dark'
            }`}
          >
            Histórico
          </Link>
        )}

        {isAdmin && (
          <Link 
            href="/admin" 
            className={`text-[10px] font-black uppercase tracking-widest transition-all ${
              pathname.startsWith('/admin') ? 'text-brand-primary' : 'text-slate-400 hover:text-brand-dark'
            }`}
          >
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <button 
          onClick={toggleCompact}
          className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-brand-primary transition-all"
          title={isCompact ? "Modo Normal" : "Modo Compacto"}
        >
          {isCompact ? <Maximize className="w-4 h-4" /> : <Minimize className="w-4 h-4" />}
        </button>
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-brand-primary transition-all"
          title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
