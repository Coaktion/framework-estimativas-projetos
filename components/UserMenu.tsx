'use client';

import { useSession, signOut, signIn } from "next-auth/react";
import { LogOut, User as UserIcon, ChevronDown, LogIn, Key } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show a "Sign In" button if no session is present
  if (status === "unauthenticated" || !session?.user) {
    return (
      <Link 
        href="/login"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full brand-bg-primary hover:bg-[color:var(--primary-hover)] transition-colors"
      >
        <LogIn className="w-4 h-4" />
        <span className="text-label font-medium">{t('userMenu.signIn')}</span>
      </Link>
    );
  }

  const initials = session.user.name 
    ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : session.user.email?.[0].toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 h-10 pl-1 pr-2.5 rounded-full border border-slate-200 bg-white hover:border-slate-400 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-brand-soft text-brand-soft-fg flex items-center justify-center text-label font-bold">
          {initials}
        </div>
        <div className="hidden lg:flex flex-col items-start leading-tight">
          <span className="text-label font-medium text-brand-dark">
            {session.user.name?.split(' ')[0] || t('userMenu.user')}
          </span>
          <span className="text-caption text-slate-500">
            {session.user.role || t('userMenu.member')}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="px-3 py-2.5 border-b border-slate-200 mb-1">
            <p className="text-caption text-slate-500">{t('userMenu.signedInAs')}</p>
            <p className="text-label font-medium text-brand-dark truncate mt-0.5">{session.user.email}</p>
          </div>
          
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-dark hover:bg-slate-100 transition-colors"
          >
            <Key className="w-4 h-4" />
            <span className="text-body font-medium">{t('userMenu.changePassword')}</span>
          </Link>

          <button 
            onClick={() => signOut({ callbackUrl: 'https://aktienowtc.netlify.app/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[color:var(--danger)] hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-body font-medium">{t('userMenu.signOut')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
