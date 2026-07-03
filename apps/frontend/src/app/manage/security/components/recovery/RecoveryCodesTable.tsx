import If from '~/core/ui/If';
import { TableRowSkeleton } from '~/components/Skeleton';
import type { RecoveryCode } from '~/lib/api/types/console';

interface RecoveryCodesTableProps {
  codes: RecoveryCode[];
  isLoading: boolean;
}

export function RecoveryCodesTable({
  codes,
  isLoading,
}: RecoveryCodesTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Code (Masked)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Expires
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Used At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Used From IP
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          <If condition={isLoading}>
            <TableRowSkeleton cols={6} />
            <TableRowSkeleton cols={6} />
            <TableRowSkeleton cols={6} />
            <TableRowSkeleton cols={6} />
            <TableRowSkeleton cols={6} />
          </If>

          <If condition={!isLoading && codes.length === 0}>
            <tr>
              <td
                colSpan={6}
                className="px-6 py-4 text-center text-sm text-gray-500"
              >
                No recovery codes found. Generate new codes to get started.
              </td>
            </tr>
          </If>

          <If condition={!isLoading && codes.length > 0}>
            {codes.map((code) => {
              const isExpiringSoon =
                new Date(code.expiresAt) <
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

              return (
                <tr
                  key={code.id}
                  className={isExpiringSoon && !code.used ? 'bg-yellow-50' : ''}
                >
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-900">
                    {code.code
                      ? `${code.code.substring(0, 4)}****${code.code.substring(code.code.length - 4)}`
                      : '****-****-****-****'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        code.used
                          ? 'bg-gray-100 text-gray-800'
                          : new Date(code.expiresAt) < new Date()
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {code.used
                        ? 'Used'
                        : new Date(code.expiresAt) < new Date()
                          ? 'Expired'
                          : 'Available'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(code.createdAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(code.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {code.usedAt ? new Date(code.usedAt).toLocaleString() : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {code.usedFromIp || '-'}
                  </td>
                </tr>
              );
            })}
          </If>
        </tbody>
      </table>
    </div>
  );
}
