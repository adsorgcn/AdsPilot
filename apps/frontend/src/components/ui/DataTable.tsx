'use client';

import { Fragment, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import { Checkbox } from '~/core/ui/Checkbox';
import IconButton from '~/core/ui/IconButton';
import classNames from 'clsx';
import Trans from '~/core/ui/Trans';

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  renderSubComponent?: (row: T) => React.ReactElement;
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  tableProps?: React.ComponentProps<typeof Table> & {
    [attr: `data-${string}`]: string;
  };
  enableRowSelection?: boolean;
  onRowSelectionChange?: (rows: T[]) => void;
  getRowId?: (row: T, index: number) => string;
  className?: string;
}

function DataTable<T extends object>({
  data,
  columns,
  renderSubComponent,
  pageIndex = 0,
  pageSize = 15,
  pageCount,
  onPaginationChange,
  tableProps,
  enableRowSelection,
  onRowSelectionChange,
  getRowId,
  className = '',
}: DataTableProps<T>) {
  const { t } = useTranslation('common');
  const [currentPage, setCurrentPage] = useState(pageIndex);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const router = useRouter();

  const navigateToPage = useCallback((page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page + 1));
    router.push(url.pathname + url.search);
  }, [router]);

  const handlePageChange = useCallback((newPageIndex: number) => {
    setCurrentPage(newPageIndex);
    if (onPaginationChange) {
      onPaginationChange({ pageIndex: newPageIndex, pageSize });
    } else {
      navigateToPage(newPageIndex);
    }
  }, [onPaginationChange, navigateToPage, pageSize]);

  const handleRowSelection = useCallback((rowId: string | number, selected: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (selected) {
      newSelectedRows.add(rowId);
    } else {
      newSelectedRows.delete(rowId);
    }
    setSelectedRows(newSelectedRows);

    if (onRowSelectionChange) {
      const selectedData = data.filter((row, index) => {
        const id = getRowId ? getRowId(row, index) : index;
        return newSelectedRows.has(id);
      });
      onRowSelectionChange(selectedData);
    }
  }, [selectedRows, data, getRowId, onRowSelectionChange]);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      const allRowIds = new Set<string | number>();
      data.forEach((row, index) => {
        const id = getRowId ? getRowId(row, index) : index;
        allRowIds.add(id);
      });
      setSelectedRows(allRowIds);
      if (onRowSelectionChange) {
        onRowSelectionChange([...data]);
      }
    } else {
      setSelectedRows(new Set());
      if (onRowSelectionChange) {
        onRowSelectionChange([]);
      }
    }
  }, [data, getRowId, onRowSelectionChange]);

  const getRowIdValue = useCallback((row: T, index: number) => {
    return getRowId ? getRowId(row, index) : index;
  }, [getRowId]);

  const renderCell = useCallback((row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row);
    }
    if (column.accessorKey) {
      return String(row[column.accessorKey] ?? '');
    }
    return '';
  }, []);

  const totalPages = pageCount ?? Math.ceil(data.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  const currentData = data.slice(startIndex, endIndex);

  const isAllSelected = enableRowSelection && currentData.length > 0 &&
    currentData.every((row, index) => {
      const id = getRowIdValue(row, index);
      return selectedRows.has(id);
    });

  const isIndeterminate = enableRowSelection && currentData.length > 0 &&
    currentData.some((row, index) => {
      const id = getRowIdValue(row, index);
      return selectedRows.has(id);
    }) && !isAllSelected;

  return (
    <div className={`border border-gray-50 dark:border-dark-800 rounded-md p-1 ${className}`}>
      <Table {...tableProps}>
        <TableHeader>
          <TableRow>
            {enableRowSelection && (
              <TableHead className="w-[48px]">
                <Checkbox
                  aria-label={t('table.selectAllRows')}
                  checked={isAllSelected}
                  onCheckedChange={(value) => handleSelectAll(Boolean(value))}
                  className="mx-auto"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.id}
                style={{ width: column.width }}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {currentData.map((row, index) => {
            const rowId = getRowIdValue(row, index);
            const isSelected = selectedRows.has(rowId);

            return (
              <Fragment key={rowId}>
                <TableRow
                  data-state={isSelected ? 'selected' : undefined}
                  className={classNames({
                    'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted':
                      renderSubComponent,
                  })}
                >
                  {enableRowSelection && (
                    <TableCell className="w-[48px]">
                      <Checkbox
                        aria-label={t('table.selectRow')}
                        checked={isSelected}
                        onCheckedChange={(value) => handleRowSelection(rowId, Boolean(value))}
                        className="mx-auto"
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      style={{ width: column.width }}
                    >
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>

                {renderSubComponent && (
                  <TableRow key={`${rowId}-expanded`}>
                    <TableCell colSpan={columns.length + (enableRowSelection ? 1 : 0)}>
                      {renderSubComponent(row)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={columns.length + (enableRowSelection ? 1 : 0)}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation('common');

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <IconButton
        onClick={() => onPageChange(0)}
        disabled={currentPage === 0}
      >
        <ChevronDoubleLeftIcon className="h-4" />
      </IconButton>

      <IconButton
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <ChevronLeftIcon className="h-4" />
      </IconButton>

      <IconButton
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
      >
        <ChevronRightIcon className="h-4" />
      </IconButton>

      <IconButton
        onClick={() => onPageChange(totalPages - 1)}
        disabled={currentPage >= totalPages - 1}
      >
        <ChevronDoubleRightIcon className="h-4" />
      </IconButton>

      <span className="flex items-center text-sm">
        <Trans
          i18nKey="common:pageOfPages"
          values={{
            page: currentPage + 1,
            total: totalPages,
          }}
        />
      </span>
    </div>
  );
}

export default DataTable;