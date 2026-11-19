'use client';

/**
 * "Este tema não se aplica" / "Esta seção não se aplica": marca de uma vez
 * todas as perguntas ainda sem status do grupo, com um único motivo.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleSlash } from 'lucide-react';
import { Button, INPUT } from '@/components/booking/ui';

export default function BulkNaButton({
  label, count, onApply, disabled,
}: {
  label: string;
  count: number;
  onApply: (reason: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (count === 0) return null;
  if (!open) {
    return (
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setOpen(true)}>
        <CircleSlash className="w-4 h-4" /> {label}
      </Button>
    );
  }
  const apply = () => {
    if (!reason.trim()) return;
    onApply(reason.trim());
    setOpen(false);
    setReason('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-[color:var(--border-main)] bg-slate-50 p-2">
      <span className="text-caption text-slate-600 dark:text-[color:var(--text-muted)]">{t('scoping.bulkNa.hint', { n: count })}</span>
      <input
        autoFocus
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setOpen(false); }}
        placeholder={t('scoping.na.reasonPh')}
        className={`${INPUT} h-9 w-64 text-label`}
        aria-label={t('scoping.na.reason')}
      />
      <Button size="sm" variant="primary" disabled={!reason.trim()} onClick={apply}>{t('scoping.bulkNa.apply')}</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('scoping.bulkNa.cancel')}</Button>
    </div>
  );
}
