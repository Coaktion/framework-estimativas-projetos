'use client';

import { useSession, signOut, signIn } from "next-auth/react";
import { LogOut, User as UserIcon, ChevronDown, LogIn } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center space-x-3 bg-slate-100 p-1.5 rounded-2xl pr-5 hover:bg-slate-200 transition-all group border border-transparent hover:border-slate-300"
      >
        <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-all">
          <LogIn className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entrar no Perfil</span>
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
        className="flex items-center space-x-3 bg-slate-100 p-1.5 rounded-2xl pr-4 hover:bg-slate-200 transition-all group border border-transparent hover:border-slate-300"
      >
        <div className="w-8 h-8 rounded-xl brand-bg-primary flex items-center justify-center text-xs font-black text-white shadow-lg group-hover:scale-105 transition-all">
          {initials}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-black text-brand-dark uppercase tracking-widest leading-none">
            {session.user.name?.split(' ')[0] || 'Usuário'}
          </span>
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {session.user.role || 'Membro'}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-48 bg-white rounded-3xl border border-slate-200 shadow-2xl p-2 z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="px-4 py-3 border-b border-slate-50 mb-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conectado como</p>
            <p className="text-[10px] font-bold text-brand-dark truncate mt-1">{session.user.email}</p>
          </div>
          
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sair do Perfil</span>
          </button>
        </div>
      )}
    </div>
  );
}
