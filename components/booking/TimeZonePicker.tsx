'use client';

/**
 * Seletor de fuso de exibição dos horários (Agendamento). Lista curada, uma
 * linha por zona IANA com as principais cidades; o rótulo mostra o offset
 * UTC atual. A busca casa cidade, país/região, zona e offset ("-3", "utc+1").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { normalizeLanguage } from '@/app/i18n/settings';
import { offsetLabel, tzOffsetMin } from '@/lib/booking/time';
import { INPUT } from './ui';

type Row = { z: string; pt: string; en?: string; es?: string; tags: string };

const ROWS: Row[] = [
  { z: 'America/Noronha', pt: 'Fernando de Noronha', tags: 'brasil brazil america' },
  { z: 'America/Sao_Paulo', pt: 'São Paulo, Rio de Janeiro, Brasília, Belo Horizonte, Salvador, Fortaleza, Recife, Curitiba, Porto Alegre', tags: 'brasil brazil america' },
  { z: 'America/Manaus', pt: 'Manaus, Cuiabá, Campo Grande, Boa Vista, Porto Velho', tags: 'brasil brazil america' },
  { z: 'America/Rio_Branco', pt: 'Rio Branco', tags: 'brasil brazil america' },
  { z: 'America/New_York', pt: 'Nova York, Miami, Washington, Boston, Atlanta, Filadélfia', en: 'New York, Miami, Washington, Boston, Atlanta, Philadelphia', es: 'Nueva York, Miami, Washington, Boston, Atlanta, Filadelfia', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Chicago', pt: 'Chicago, Houston, Dallas, Austin, Minneapolis, Nova Orleans', en: 'Chicago, Houston, Dallas, Austin, Minneapolis, New Orleans', es: 'Chicago, Houston, Dallas, Austin, Minneapolis, Nueva Orleans', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Denver', pt: 'Denver, Salt Lake City', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Phoenix', pt: 'Phoenix', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Los_Angeles', pt: 'Los Angeles, São Francisco, Seattle, Las Vegas, San Diego, Portland', en: 'Los Angeles, San Francisco, Seattle, Las Vegas, San Diego, Portland', es: 'Los Ángeles, San Francisco, Seattle, Las Vegas, San Diego, Portland', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Anchorage', pt: 'Anchorage (Alasca)', en: 'Anchorage (Alaska)', tags: 'eua estados unidos usa united states america' },
  { z: 'Pacific/Honolulu', pt: 'Honolulu (Havaí)', en: 'Honolulu (Hawaii)', es: 'Honolulu (Hawái)', tags: 'eua estados unidos usa united states america' },
  { z: 'America/Mexico_City', pt: 'Cidade do México, Guadalajara, Monterrey, Puebla', en: 'Mexico City, Guadalajara, Monterrey, Puebla', es: 'Ciudad de México, Guadalajara, Monterrey, Puebla', tags: 'mexico méxico america' },
  { z: 'America/Cancun', pt: 'Cancún, Tulum', tags: 'mexico méxico america' },
  { z: 'America/Tijuana', pt: 'Tijuana, Mexicali', tags: 'mexico méxico america' },
  { z: 'America/Bogota', pt: 'Bogotá, Lima, Quito, Panamá', en: 'Bogotá, Lima, Quito, Panama City', es: 'Bogotá, Lima, Quito, Ciudad de Panamá', tags: 'colombia peru perú equador ecuador panama panamá america' },
  { z: 'America/Santiago', pt: 'Santiago', tags: 'chile america' },
  { z: 'America/Argentina/Buenos_Aires', pt: 'Buenos Aires, Montevidéu', en: 'Buenos Aires, Montevideo', es: 'Buenos Aires, Montevideo', tags: 'argentina uruguai uruguay america' },
  { z: 'America/St_Johns', pt: "St. John's (Terra Nova)", en: "St. John's (Newfoundland)", es: "St. John's (Terranova)", tags: 'canada canadá america' },
  { z: 'America/Halifax', pt: 'Halifax', tags: 'canada canadá america' },
  { z: 'America/Toronto', pt: 'Toronto, Ottawa, Montreal, Quebec', tags: 'canada canadá america' },
  { z: 'America/Winnipeg', pt: 'Winnipeg', tags: 'canada canadá america' },
  { z: 'America/Edmonton', pt: 'Calgary, Edmonton', tags: 'canada canadá america' },
  { z: 'America/Vancouver', pt: 'Vancouver, Victoria', tags: 'canada canadá america' },
  { z: 'Atlantic/Azores', pt: 'Açores', en: 'Azores', es: 'Azores', tags: 'portugal europa europe' },
  { z: 'Europe/Lisbon', pt: 'Lisboa, Porto, Braga, Coimbra', en: 'Lisbon, Porto, Braga, Coimbra', es: 'Lisboa, Oporto, Braga, Coímbra', tags: 'portugal europa europe' },
  { z: 'Europe/London', pt: 'Londres, Dublin, Edimburgo', en: 'London, Dublin, Edinburgh', es: 'Londres, Dublín, Edimburgo', tags: 'reino unido united kingdom uk irlanda ireland europa europe' },
  { z: 'Europe/Paris', pt: 'Paris, Madri, Barcelona, Roma, Milão, Berlim, Munique, Amsterdã, Bruxelas, Zurique, Viena', en: 'Paris, Madrid, Barcelona, Rome, Milan, Berlin, Munich, Amsterdam, Brussels, Zurich, Vienna', es: 'París, Madrid, Barcelona, Roma, Milán, Berlín, Múnich, Ámsterdam, Bruselas, Zúrich, Viena', tags: 'europa europe franca frança france espanha españa spain italia itália italy alemanha alemania germany' },
  { z: 'Europe/Athens', pt: 'Atenas, Helsinque, Bucareste, Kiev', en: 'Athens, Helsinki, Bucharest, Kyiv', es: 'Atenas, Helsinki, Bucarest, Kiev', tags: 'europa europe grecia grécia greece finlandia finland' },
  { z: 'Europe/Istanbul', pt: 'Istambul, Moscou', en: 'Istanbul, Moscow', es: 'Estambul, Moscú', tags: 'europa europe turquia turkey russia rússia' },
  { z: 'UTC', pt: 'UTC', tags: 'utc gmt' },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = normalizeLanguage(i18n.language);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const label = (z: string) => {
    const row = ROWS.find((r) => r.z === z);
    return `${offsetLabel(tzOffsetMin(z))} · ${row ? row[lang] || row.pt : z.replace(/_/g, ' ')}`;
  };

  const rows = useMemo(() => {
    const list = ROWS.some((r) => r.z === value) ? ROWS : [{ z: value, pt: value.replace(/_/g, ' '), tags: '' }, ...ROWS];
    const q = fold(query.trim());
    if (!q) return list;
    return list.filter((r) => {
      const off = offsetLabel(tzOffsetMin(r.z)).toLowerCase();
      const hay = fold(`${r.pt} ${r.en || ''} ${r.es || ''} ${r.tags} ${r.z.replace(/[_/]/g, ' ')}`) + ` ${off} ${off.replace('utc', '')} ${off.replace('utc', 'gmt')}`;
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [query, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={boxRef} className="relative w-full sm:w-[360px]">
      <span className="sr-only">{t('booking.flow.timeZone')}</span>
      <Clock3 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        role="combobox"
        aria-expanded={open}
        title={t('booking.flow.timeZoneTip')}
        value={open ? query : label(value)}
        placeholder={t('booking.flow.timeZoneSearch')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && rows[0]) { onChange(rows[0].z); setOpen(false); }
        }}
        className={`${INPUT} pl-10 truncate`}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1" role="listbox">
          {rows.length === 0 && <li className="px-3 py-2 text-label text-slate-500">{t('booking.flow.timeZoneNone')}</li>}
          {rows.map((r) => (
            <li key={r.z}>
              <button
                type="button"
                role="option"
                aria-selected={r.z === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(r.z); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-label hover:bg-slate-100 ${r.z === value ? 'font-semibold text-brand-dark' : 'text-slate-600'}`}
              >
                {label(r.z)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
