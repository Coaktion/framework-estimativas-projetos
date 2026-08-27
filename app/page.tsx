import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes, canAccessAE } from "@/lib/segments";

export default async function Home() {
  const t = getServerT();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const isAdmin = user?.isAdmin || false;

  const showScopes = canAccessScopes(user);
  const showAE = canAccessAE(user);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-black text-brand-dark tracking-tighter uppercase font-heading leading-tight">
          PRE-SALES<span className="text-brand-accent">.AI</span>
        </h1>
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em]">{t('home.tagline')}</p>
      </div>

      <div className={`grid grid-cols-1 gap-8 w-full max-w-5xl ${
        isAdmin ? 'md:grid-cols-3' : (showScopes ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md')
      }`}>
        {showScopes && (
          <Link href="/sc" className="group bg-white p-12 rounded-[3rem] border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl flex flex-col items-center space-y-8">
            <div className="w-16 h-16 brand-bg-primary rounded-[2rem] flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('home.newProject')}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{t('home.newProjectSubtitle')}</p>
            </div>
          </Link>
        )}

        {showAE && (
          <Link href="/ae/history" className="group bg-white p-12 rounded-[3rem] border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl flex flex-col items-center space-y-8">
            <div className="w-16 h-16 brand-bg-primary rounded-[2rem] flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('home.aeCalculator')}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{t('home.aeCalculatorSubtitle')}</p>
            </div>
          </Link>
        )}

        {isAdmin && (
          <Link href="/admin" className="group bg-white p-12 rounded-[3rem] border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl flex flex-col items-center space-y-8">
            <div className="w-16 h-16 brand-bg-primary rounded-[2rem] flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('home.admin')}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{t('home.adminSubtitle')}</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
