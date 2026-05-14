'use client';

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield, Zap, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenciais inválidas. Verifique seu email e senha.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Ocorreu um erro ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-8">
          <div className="brand-bg-primary p-6 rounded-[2.5rem] shadow-2xl shadow-green-900/20 rotate-3 hover:rotate-0 transition-all duration-500">
            <Zap className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-black text-brand-dark tracking-tighter uppercase font-heading leading-tight">
          PRE-SALES<span className="text-brand-accent">.AI</span>
        </h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Acesso restrito ao time Aktie Now</p>
      </div>

      <div className="w-full max-w-md bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center space-x-3 animate-in shake duration-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Mail className="w-3 h-3" />
              <span>Email Corporativo</span>
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@aktienow.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Lock className="w-3 h-3" />
              <span>Sua Senha</span>
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-dark text-white p-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>
        </form>
        
        <div className="pt-4 flex items-center justify-center space-x-2 text-slate-300">
          <Shield className="w-3 h-3" />
          <span className="text-[8px] font-black uppercase tracking-widest">Proteção de Dados Coaktion</span>
        </div>
      </div>
    </div>
  );
}
