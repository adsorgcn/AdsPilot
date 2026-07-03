import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import type { RecoveryCode } from '~/lib/api/types/console';

interface NewCodesDisplayProps {
  codes: RecoveryCode[];
  onCopyAll: (text: string) => void;
  onDownload: () => void;
}

export function NewCodesDisplay({
  codes,
  onCopyAll,
  onDownload,
}: NewCodesDisplayProps) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-medium text-green-900">
          ⚠️ Save These Codes Now - They Won&apos;t Be Shown Again!
        </h4>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopyAll(codes.map((c) => c.code).join('\n'))}
          >
            <DocumentDuplicateIcon className="mr-1 h-4 w-4" />
            Copy All
          </Button>
          <Button size="sm" variant="outline" onClick={onDownload}>
            Download
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {codes.map((code) => (
          <div key={code.id} className="rounded bg-white p-3 font-mono text-sm">
            {code.code}
          </div>
        ))}
      </div>
    </div>
  );
}
