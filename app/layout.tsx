import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.scss";
import Link from "next/link";
import Providers from "@/components/Providers";
import UserMenu from "@/components/UserMenu";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PRE-SALES.AI | Smart Scoping",
  description: "Framework para o time de pré-vendas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-300 py-6 px-4 sm:px-8 flex items-center justify-between shadow-sm sticky top-0 z-50 transition-all duration-500">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-black text-brand-dark tracking-tighter uppercase font-heading group-hover:tracking-normal transition-all duration-500">
                PRE-SALES<span className="text-brand-accent">.AI</span>
              </span>
            </Link>

            <Navbar />

            <div className="flex items-center space-x-6">
               <UserMenu />
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
