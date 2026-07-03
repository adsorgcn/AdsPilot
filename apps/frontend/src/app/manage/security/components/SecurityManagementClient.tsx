'use client';

import { KeyIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import If from '~/core/ui/If';
import InputDialog from '~/components/InputDialog';

import { useRecoveryCodeManagement } from '../hooks/useRecoveryCodeManagement';
import { NewCodesDisplay } from './recovery/NewCodesDisplay';
import { RecoveryCodesTable } from './recovery/RecoveryCodesTable';

export default function SecurityManagementClient() {
  const state = useRecoveryCodeManagement();

  return (
    <div className="flex flex-col space-y-4">
      {/* Error Message */}
      <If condition={!!state.error}>
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{state.error}</div>
            </div>
          </div>
        </div>
      </If>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Recovery Codes</h3>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={state.handleExportCsv}
            disabled={state.isLoading || state.recoveryCodes.length === 0}
          >
            <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={state.handleGenerateCodes}
            disabled={state.isLoading}
          >
            <KeyIcon className="mr-2 h-4 w-4" />
            Generate New Codes
          </Button>
        </div>
      </div>

      {/* New Codes Display (shown immediately after generation) */}
      <If condition={state.showCodes && state.generatedCodes.length > 0}>
        <NewCodesDisplay
          codes={state.generatedCodes}
          onCopyAll={state.copyToClipboard}
          onDownload={state.downloadCodes}
        />
      </If>

      {/* Existing Codes Table */}
      <RecoveryCodesTable
        codes={state.recoveryCodes}
        isLoading={state.isLoading}
      />

      {/* Warning */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          <strong>Security Note:</strong> Generating new recovery codes will
          automatically revoke all existing unused codes. Used codes remain in
          the audit log for compliance purposes.
        </p>
      </div>

      {/* Generate Codes Dialog */}
      <InputDialog
        open={state.showGenerateDialog}
        onOpenChange={state.setShowGenerateDialog}
        title="Generate Recovery Codes"
        description="This will revoke all existing unused recovery codes. Please save the new codes securely as they will only be shown once."
        fields={[
          {
            name: 'count',
            label: 'Number of codes',
            type: 'number',
            defaultValue: '10',
            placeholder: 'Enter number of codes (1-20)',
            required: true,
            min: 1,
            max: 20,
          },
          {
            name: 'reason',
            label: 'Reason for generation',
            placeholder: 'Enter reason (minimum 10 characters)',
            required: true,
            minLength: 10,
          },
        ]}
        confirmLabel="Generate Codes"
        onConfirm={state.confirmGenerateCodes}
      />
    </div>
  );
}
