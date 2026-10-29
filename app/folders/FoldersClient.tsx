'use client';

import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, FolderPlus } from 'lucide-react';
import { Banner, Button, Chip, Hint, Label, PageHeader, Section, TextInput } from '@/components/booking/ui';
import { CLIENT_NAME_MAX, FOLDER_REGIONS, FOLDER_REGION_LABELS, normalizeClientName, type FolderRegion, type FolderResult } from '@/lib/folders';
import { createClientFoldersAction } from './actions';

const SUBFOLDERS = ['0 - SALES', '1 - PRESALES', '2 - DELIVERY', '3 - CUSTOMER SUCCESS'];

export default function FoldersClient({ configured }: { configured: boolean }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [cliente, setCliente] = useState('');
  const [regiao, setRegiao] = useState<FolderRegion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(FolderResult & { cliente: string }) | null>(null);
  const [copied, setCopied] = useState(false);

  const nome = normalizeClientName(cliente);
  const canSubmit = configured && !!nome && nome.length <= CLIENT_NAME_MAX && !!regiao && !pending;

  const submit = () => {
    if (!canSubmit || !regiao) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await createClientFoldersAction(nome, regiao);
      if (!res.ok) {
        const { error: code, detail } = res as { error: string; detail?: string };
        const base = t(`folders.errors.${code}`, { defaultValue: '' }) || t('folders.errors.script_error');
        setError(detail ? `${base} (${detail})` : base);
        return;
      }
      setResult({ url: res.url, status: res.status, subfoldersCreated: res.subfoldersCreated, cliente: nome });
      setCliente('');
      setRegiao(null);
    });
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="space-y-10">
      <PageHeader title={t('folders.titleA')} accent={t('folders.titleB')} subtitle={t('folders.subtitle')} />

      {!configured && <Banner tone="warn">{t('folders.notConfigured')}</Banner>}

      <Section title={t('folders.formTitle')} description={t('folders.formDesc', { subfolders: SUBFOLDERS.join(' · ') })}>
        <form
          className="space-y-6 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div>
            <Label htmlFor="folders-client">{t('folders.clientName')}</Label>
            <TextInput
              id="folders-client"
              value={cliente}
              maxLength={CLIENT_NAME_MAX}
              placeholder={t('folders.clientPlaceholder')}
              onChange={(e) => setCliente(e.target.value)}
              disabled={!configured || pending}
              autoComplete="off"
            />
            <Hint>{t('folders.clientHint')}</Hint>
          </div>

          <div>
            <Label>{t('folders.region')}</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('folders.region')}>
              {FOLDER_REGIONS.map((r) => (
                <Chip key={r} on={regiao === r} onClick={() => setRegiao(r)}>
                  {FOLDER_REGION_LABELS[r]}
                </Chip>
              ))}
            </div>
          </div>

          <Button type="submit" variant="primary" busy={pending} disabled={!canSubmit}>
            <FolderPlus className="w-4 h-4" /> {pending ? t('folders.creating') : t('folders.create')}
          </Button>
        </form>

        {error && <div className="mt-6"><Banner tone="error">{error}</Banner></div>}

        {result && (
          <div className="mt-6">
            <Banner tone="ok">
              <p className="font-medium">
                {t(`folders.result.${result.status}`, { cliente: result.cliente, count: result.subfoldersCreated })}
              </p>
              {result.url && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3.5 rounded-full border border-slate-300 bg-white text-label font-medium text-brand-dark inline-flex items-center gap-2 hover:border-slate-400"
                  >
                    <ExternalLink className="w-4 h-4" /> {t('folders.openFolder')}
                  </a>
                  <Button size="sm" onClick={() => copyLink(result.url)}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {t('folders.copyLink')}
                  </Button>
                </div>
              )}
            </Banner>
          </div>
        )}
      </Section>
    </div>
  );
}
