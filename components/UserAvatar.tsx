'use client';

import { useEffect, useState } from 'react';

/** Iniciais (até 2 letras) do nome, ou a 1ª letra do e-mail. */
export function initialsOf(name?: string | null, email?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return String(email || '').trim()[0]?.toUpperCase() || 'U';
}

/**
 * Foto do Google em tamanho adequado. As URLs do Google (lh3.googleusercontent)
 * terminam em "=s96-c" (96px); troca pelo tamanho pedido para não ficar borrada.
 */
function sizedPicture(url: string, px: number): string {
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, `=s${px}-c`) : url;
}

type Props = {
  name?: string | null;
  email?: string | null;
  /** URL da foto (foto do perfil Google, gravada no login). */
  picture?: string | null;
  /** Tamanho/forma/cores do contêiner, ex.: "w-8 h-8 rounded-full text-label". */
  className?: string;
  /** Tamanho em px pedido ao Google (use ~2x o tamanho exibido). */
  px?: number;
};

/**
 * Avatar do usuário: a foto do Google quando existe e carrega; senão, as
 * iniciais. `referrerPolicy="no-referrer"` evita o 403 que o Google às vezes
 * devolve para fotos pedidas a partir de outro site.
 */
export default function UserAvatar({ name, email, picture, className = '', px = 96 }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [picture]);

  const showPhoto = Boolean(picture) && !failed;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden font-bold select-none ${
        showPhoto ? 'bg-slate-100' : 'bg-brand-soft text-brand-soft-fg'
      } ${className}`}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sizedPicture(picture!, px)}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name, email)
      )}
    </span>
  );
}
