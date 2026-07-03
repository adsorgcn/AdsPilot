/**
 * CSV Export Utility
 *
 * Converts data to CSV format and triggers download
 */

export interface CsvColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  format?: (value: unknown, row: T) => string;
}

export function exportToCsv<T = Record<string, unknown>>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const header = columns.map((col) => escapeCsvValue(col.label)).join(',');

  const rows = data.map((row) => {
    const record = row as Record<string, unknown>;

    return columns
      .map((col) => {
        const rawValue = getColumnValue(record, col.key);
        const formattedValue = col.format
          ? col.format(rawValue, row)
          : String(rawValue ?? '');

        return escapeCsvValue(formattedValue);
      })
      .join(',');
  });

  const csv = [header, ...rows].join('\n');

  downloadCsv(csv, filename);
}

function getColumnValue(
  source: Record<string, unknown>,
  key: string | number | symbol,
) {
  const normalizedKey = typeof key === 'string' ? key : String(key);
  return normalizedKey in source ? source[normalizedKey] : undefined;
}

function escapeCsvValue(value: string): string {
  const stringValue = String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
