'use client';

import { useState, useTransition } from "react";
import { KeyRound, Plus, Trash2, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

type ApiKeyRow = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

type Props = {
  initialKeys: ApiKeyRow[];
  /** Endereço do MCP do Tool Center (para o comando de configuração). */
  mcpUrl: string;
};

/**
 * Chaves de API do Tool Center, usadas pelo MCP (Claude Code, Cowork...).
 * A chave aparece uma única vez, logo depois de criada.
 */
export default function ApiKeysCard({ initialKeys, mcpUrl }: Props) {
  const { t, i18n } = useTranslation();
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<'key' | 'command' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const command = `claude mcp add --transport http toolcenter ${mcpUrl} --header "Authorization: Bearer ${newKey ?? 'tc_...'}"`;

  const copy = async (text: string, what: 'key' | 'command') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* sem permissão de clipboard: o texto continua visível para copiar à mão */
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createApiKeyAction(name);
      if (res.success && res.key && res.row) {
        setNewKey(res.key);
        setKeys((prev) => [res.row!, ...prev]);
        setName("");
      } else {
        setError(res.error || t('errors.generic'));
      }
    });
  };

  const handleRevoke = (row: ApiKeyRow) => {
    if (!confirm(t('profile.apiKeyRevokeConfirm', { name: row.name }))) return;
    startTransition(async () => {
      const res = await revokeApiKeyAction(row.id);
      if (res.success) setKeys((prev) => prev.filter((k) => k.id !== row.id));
    });
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }) : t('profile.apiKeyNeverUsed');

  const inputClass = "flex-1 h-12 bg-[color:var(--bg-input-solid)] border border-[color:var(--border-main)] rounded-[10px] px-4 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-[color:var(--text-subtle)] disabled:opacity-50";

  return (
    <div className="bg-[color:var(--bg-card-solid)] border border-[color:var(--border-main)] rounded-2xl p-8 shadow-sm space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-brand-primary" />
          <h2 className="text-title font-medium text-brand-dark">{t('profile.apiKeys')}</h2>
        </div>
        <p className="text-body text-[color:var(--text-muted)]">{t('profile.apiKeysHint')}</p>
      </div>

      {newKey && (
        <div className="border border-[#7FD171] bg-[color:var(--accent-tint)] p-4 rounded-[10px] space-y-3">
          <p className="text-body font-medium text-brand-dark flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {t('profile.apiKeyShownOnce')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-caption bg-[color:var(--bg-input-solid)] border border-[color:var(--border-main)] rounded-lg p-2.5">{newKey}</code>
            <button type="button" onClick={() => copy(newKey, 'key')} className="h-10 w-10 shrink-0 rounded-lg border border-[color:var(--border-main)] flex items-center justify-center hover:border-brand-primary" title={t('profile.apiKeyCopy')}>
              {copied === 'key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-caption text-[color:var(--text-muted)]">{t('profile.apiKeyCommandHint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-caption bg-[color:var(--bg-input-solid)] border border-[color:var(--border-main)] rounded-lg p-2.5">{command}</code>
            <button type="button" onClick={() => copy(command, 'command')} className="h-10 w-10 shrink-0 rounded-lg border border-[color:var(--border-main)] flex items-center justify-center hover:border-brand-primary" title={t('profile.apiKeyCopy')}>
              {copied === 'command' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button type="button" onClick={() => setNewKey(null)} className="text-caption font-medium text-[color:var(--text-muted)] hover:text-brand-dark underline">
            {t('profile.apiKeyDone')}
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          required
          maxLength={60}
          disabled={isPending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('profile.apiKeyNamePlaceholder')}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-6 brand-bg-primary rounded-full text-body font-medium btn-premium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>{t('profile.apiKeyCreate')}</span>
        </button>
      </form>

      {error && (
        <div role="alert" className="border border-[color:var(--danger)] text-[color:var(--danger)] p-3.5 rounded-[10px] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-body font-medium leading-tight">{error}</span>
        </div>
      )}

      {keys.length > 0 ? (
        <ul className="divide-y divide-[color:var(--border-main)] border border-[color:var(--border-main)] rounded-[10px]">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-body font-medium text-brand-dark truncate">{k.name}</div>
                <div className="text-caption text-[color:var(--text-muted)]">
                  <code>{k.prefix}…</code> · {t('profile.apiKeyCreatedAt', { date: fmtDate(k.createdAt) })} · {t('profile.apiKeyLastUsed', { date: fmtDate(k.lastUsedAt) })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(k)}
                disabled={isPending}
                className="h-9 px-3 rounded-full border border-[color:var(--border-main)] text-caption font-medium text-[color:var(--text-muted)] hover:border-[color:var(--danger)] hover:text-[color:var(--danger)] flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('profile.apiKeyRevoke')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-[color:var(--text-subtle)]">{t('profile.apiKeysEmpty')}</p>
      )}
    </div>
  );
}
