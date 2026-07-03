'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import { useTranslation } from 'react-i18next';

interface Props {
  userId: string;
  userEmail?: string;
}

export default function ManualSetupForm({ userId, userEmail }: Props) {
  const router = useRouter();
  const { t } = useTranslation('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(userEmail?.split('@')[0] || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();

      // 重定向到dashboard
      router.push(data.redirectUrl || '/dashboard');
    } catch (err) {
      console.error('Manual setup failed', err);
      setError(t('form.errors.setupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField>
        <TextField.Label>
          {t('form.displayNameLabel')}
        </TextField.Label>
        <TextField.Input
          value={displayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
          placeholder={t('form.displayNamePlaceholder')}
          required
        />
      </TextField>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Button
        type="submit"
        loading={loading}
        block
      >
        {t('form.submit')}
      </Button>
    </form>
  );
}
