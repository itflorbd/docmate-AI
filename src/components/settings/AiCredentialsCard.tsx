'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  Globe2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'gpt-4-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  custom: ['llama-3.1-8b', 'mistral-large', 'deepseek-r1', 'qwen-2.5'],
};

interface AiCredentialsCardProps {
  className?: string;
}

export function AiCredentialsCard({ className = '' }: AiCredentialsCardProps) {
  const t = useTranslations('settings');

  const [provider, setProvider] = useState<'openai' | 'gemini' | 'anthropic' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Status state
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [testStatus, setTestStatus] = useState<'success' | 'failed' | 'untested'>('untested');
  const [testMessage, setTestMessage] = useState('');
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Loading states
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Load existing credentials
  useEffect(() => {
    let mounted = true;
    fetch('/api/settings/ai-credentials')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
        if (data.baseUrl) setBaseUrl(data.baseUrl);
        if (data.organizationId) setOrganizationId(data.organizationId);
        setHasKey(Boolean(data.hasKey));
        setMaskedKey(data.maskedKey || '');
        if (data.testStatus) setTestStatus(data.testStatus);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setFetching(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Update default model when provider changes
  const handleProviderChange = (newProvider: 'openai' | 'gemini' | 'anthropic' | 'custom') => {
    setProvider(newProvider);
    const defaults = PROVIDER_MODELS[newProvider];
    if (defaults && defaults.length > 0) {
      setModel(defaults[0]);
    }
    if (newProvider === 'custom' && !baseUrl) {
      setBaseUrl('http://localhost:11434/v1');
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestMessage('');
    try {
      const res = await fetch('/api/settings/ai-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          model,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestLatency(data.latencyMs ?? null);
        setTestMessage(data.message || t('testSuccess'));
        toast.success(data.message || t('testSuccess'));
      } else {
        setTestStatus('failed');
        setTestMessage(data.error || data.message || t('testFailed'));
        toast.error(data.error || data.message || t('testFailed'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('testFailed');
      setTestStatus('failed');
      setTestMessage(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  // Save credentials
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/ai-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          model,
          baseUrl: baseUrl.trim() || undefined,
          organizationId: organizationId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      setHasKey(Boolean(data.hasKey));
      setMaskedKey(data.maskedKey || '');
      setApiKey(''); // clear plain input once stored
      toast.success(t('saveSuccess'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving credentials';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <Card className={`border-border ${className}`}>
        <CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading credentials...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border bg-card shadow-xs ${className}`}>
      <form onSubmit={handleSave}>
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{t('aiCredentialsTitle')}</span>
            </CardTitle>

            <div className="flex items-center gap-2">
              {hasKey ? (
                <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('statusConnected')}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{t('statusMissing')}</span>
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs leading-relaxed text-muted-foreground">
            {t('aiCredentialsDesc')}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('provider')}</span>
              </Label>
              <select aria-label={t('provider')}
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'gemini' | 'anthropic' | 'custom')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="openai">OpenAI (ChatGPT / GPT-4o)</option>
                <option value="gemini">Google Gemini (Flash / Pro)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                <option value="custom">Custom Endpoint (Ollama / Local LLM / Azure)</option>
              </select>
            </div>

            {/* Model selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('model')}</span>
              </Label>
              <div className="flex gap-2">
                <select aria-label={t('model')}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {(PROVIDER_MODELS[provider] || []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={model}>Other / Custom Model...</option>
                </select>
              </div>
            </div>
          </div>

          {/* API Key Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('apiKey')}</span>
              </Label>
              {hasKey && maskedKey && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  Saved: <strong className="text-foreground">{maskedKey}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? '•••••••••••••••• (Leave blank to keep current key)' : t('apiKeyPlaceholder')}
                className="text-xs pr-9 font-mono"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Custom Base URL (Optional / Custom Provider) */}
          {(provider === 'custom' || baseUrl) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('baseUrl')}</span>
              </Label>
              <Input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t('baseUrlPlaceholder')}
                className="text-xs font-mono"
              />
            </div>
          )}

          {/* Test Status Banner */}
          {testStatus !== 'untested' && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                testStatus === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive'
              }`}
            >
              {testStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold leading-none">
                  {testStatus === 'success' ? t('testSuccess') : t('testFailed')}
                  {testLatency !== null && ` (${testLatency}ms)`}
                </p>
                {testMessage && <p className="text-[11px] opacity-90">{testMessage}</p>}
              </div>
            </div>
          )}

          {/* Security & BYOK Notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{t('byokNotice')}</span>
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || (!hasKey && !apiKey.trim())}
            className="text-xs h-8 gap-1.5"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-primary" />}
            <span>{testing ? t('testing') : t('testConnection')}</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="text-xs h-8 gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{saving ? t('saving') : t('save')}</span>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
