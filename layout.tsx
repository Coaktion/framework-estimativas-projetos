import type { Metadata } from "next";
import { Bebas_Neue, Roboto } from "next/font/google";
import "./globals.scss";
import Link from "next/link";
import Image from "next/image";
import Providers from "@/components/Providers";
import UserMenu from "@/components/UserMenu";
import Navbar from "@/components/Navbar";
import FeedbackButton from "@/components/FeedbackButton";
import { getUserPreferencesAction } from "@/lib/preferences";
import { getServerLanguage, getServerT } from "@/app/i18n/server";
import { HTML_LANG, normalizeLanguage } from "@/app/i18n/settings";

// Aktie Now: Bebas Neue (títulos e números, sempre regular) + Roboto (todo o resto).
const fontDisplay = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const fontBody = Roboto({
  weight: ["300", "400", "500", "700", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const prefs = await getUserPreferencesAction();
  const initialTheme = (prefs?.theme as any) || 'dark';
  const initialIsCompact = Boolean(prefs?.isCompact);
  // O cookie tem prioridade: é o que o usuário acabou de escolher neste browser.
  // Se não houver cookie, usamos a preferência salva no banco.
  const cookieLanguage = getServerLanguage();
  const initialLanguage = normalizeLanguage(cookieLanguage || (prefs as any)?.language);
  const htmlClassName = `${fontDisplay.variable} ${fontBody.variable}${initialTheme === 'dark' ? ' dark' : ''}${initialIsCompact ? ' compact' : ''}`;

  return (
    <html lang={HTML_LANG[initialLanguage]} className={htmlClassName}>
      <body className="font-sans min-h-screen flex flex-col overflow-x-clip">
        <Providers initialTheme={initialTheme} initialIsCompact={initialIsCompact} initialLanguage={initialLanguage}>
          <nav className="border-b border-slate-200 px-4 sm:px-8 min-h-[68px] flex items-center gap-6 sticky top-0 z-50">
            <Link href="/" className="flex items-center gap-3.5 shrink-0" aria-label="Tool Center">
              {/* Logo oficial (assets da marca), proporção nativa 640×218 */}
              <Image src="/brand/logos/aktie-now-color-black.png" alt="aktie now" width={640} height={218} priority unoptimized className="h-[26px] w-auto dark:hidden" />
              <Image src="/brand/logos/aktie-now-color-white.png" alt="aktie now" width={640} height={218} priority unoptimized className="h-[26px] w-auto hidden dark:block" />
              <span className="hidden sm:inline font-heading text-[24px] leading-none text-brand-dark pl-3.5 border-l border-slate-300">
                Tool Center
              </span>
            </Link>

            <Navbar />

            <div className="flex items-center gap-2 ml-auto md:ml-0 shrink-0">
               <FeedbackButton />
               <UserMenu />
            </div>
          </nav>

          <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 flex-1">
            {children}
          </main>

          <footer className="border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-4">
              {/* Rodapé: sempre a assinatura endossada (Part of the Coaktion Ecosystem), proporção 640×254 */}
              <Image src="/brand/logos/aktie-now-endorsed-color-black.png" alt="aktie now, part of the Coaktion Ecosystem" width={640} height={254} unoptimized className="h-10 w-auto dark:hidden" />
              <Image src="/brand/logos/aktie-now-endorsed-color-white.png" alt="aktie now, part of the Coaktion Ecosystem" width={640} height={254} unoptimized className="h-10 w-auto hidden dark:block" />
              <span className="text-caption text-slate-500">Tool Center · Pre-Sales AI</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
