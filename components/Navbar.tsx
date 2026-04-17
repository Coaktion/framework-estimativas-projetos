'use client';

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user) return null;

  const role = session.user.role;
  const isAdmin = session.user.isAdmin;

  // Permissões Rígidas:
  // AE: Apenas Validar AE e Minhas Estimativas
  // SC: Validar AE + Projetos (SC)
  // ADMIN: Todas

  const isAE = role === 'AE';
  const isSC = role === 'SC';

  return (
    <div className="hidden md:flex items-center space-x-12">
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
          Minhas Estimativas
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
  );
}
