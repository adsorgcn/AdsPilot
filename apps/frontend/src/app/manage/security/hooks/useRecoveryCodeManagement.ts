import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';

import type { RecoveryCode } from '~/lib/api/types/console';
import { generateRecoveryCodes } from '~/lib/api/console/recovery-codes';
import { useConsoleRecoveryCodes } from '~/lib/admin/resources/recovery-codes';
import { exportToCsv } from '~/lib/utils/csv-export';

import {
  maskRecoveryCode,
  formatDateValue,
  formatDateTimeValue,
  formatRecoveryStatus,
} from '../utils/recovery-code-formatters';

export function useRecoveryCodeManagement() {
  const {
    data: recoveryCodesData,
    error: recoveryCodesError,
    isLoading,
    refetch,
  } = useConsoleRecoveryCodes({});

  const recoveryCodes = useMemo(
    () => recoveryCodesData?.items ?? [],
    [recoveryCodesData],
  );

  const [generatedCodes, setGeneratedCodes] = useState<RecoveryCode[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const error = recoveryCodesError
    ? recoveryCodesError instanceof Error
      ? recoveryCodesError.message
      : 'Failed to load recovery codes'
    : null;

  const handleGenerateCodes = useCallback(() => {
    setShowGenerateDialog(true);
  }, []);

  const confirmGenerateCodes = useCallback(
    async (values: Record<string, string>) => {
      try {
        const codes = await generateRecoveryCodes({
          count: parseInt(values.count, 10),
          expiryDays: 90,
          reason: values.reason,
        });
        setGeneratedCodes(codes);
        setShowCodes(true);
        await refetch();
        toast.success(
          'Recovery codes generated successfully! Please save them now.',
        );
      } catch (err) {
        toast.error(
          `Failed to generate recovery codes: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        throw err;
      }
    },
    [refetch],
  );

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  }, []);

  const downloadCodes = useCallback(() => {
    const codesForDownload =
      showCodes && generatedCodes.length > 0 ? generatedCodes : recoveryCodes;

    const text = codesForDownload
      .map((code: RecoveryCode) => `${code.code} (Expires: ${code.expiresAt})`)
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [showCodes, generatedCodes, recoveryCodes]);

  const handleExportCsv = useCallback(() => {
    try {
      exportToCsv<RecoveryCode>(
        recoveryCodes,
        [
          {
            key: 'code',
            label: 'Code (Masked)',
            format: (value) => maskRecoveryCode(value),
          },
          {
            key: 'used',
            label: 'Status',
            format: (used, row) => formatRecoveryStatus(used, row),
          },
          {
            key: 'createdAt',
            label: 'Created',
            format: (value) => formatDateValue(value),
          },
          {
            key: 'expiresAt',
            label: 'Expires',
            format: (value) => formatDateValue(value),
          },
          {
            key: 'usedAt',
            label: 'Used At',
            format: (value) => formatDateTimeValue(value),
          },
          {
            key: 'usedFromIp',
            label: 'Used From IP',
            format: (value) =>
              typeof value === 'string' && value.length ? value : '-',
          },
        ],
        `recovery-codes-${new Date().toISOString().split('T')[0]}.csv`,
      );
      toast.success(`Exported ${recoveryCodes.length} recovery codes to CSV`);
    } catch (err) {
      toast.error(
        `Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }, [recoveryCodes]);

  return {
    recoveryCodes,
    generatedCodes,
    showCodes,
    showGenerateDialog,
    setShowGenerateDialog,
    isLoading,
    error,
    handleGenerateCodes,
    confirmGenerateCodes,
    copyToClipboard,
    downloadCodes,
    handleExportCsv,
  };
}
