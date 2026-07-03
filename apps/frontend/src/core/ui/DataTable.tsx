'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import {
  getCoreRowModel,
  useReactTable,
  flexRender,
  VisibilityState,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

import type {
  ColumnDef,
  Row,
  Table as ReactTable,
  PaginationState,
} from '@tanstack/react-table';

import classNames from 'clsx';
import IconButton from '~/core/ui/IconButton';

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

import Trans from '~/core/ui/Trans';

interface ReactTableProps<T extends object> {
  data: T[];
  columns: ColumnDef<T>[];
  renderSubComponent?: (props: { row: Row<T> }) => React.ReactElement;
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  onPaginationChange?: (pagination: PaginationState) => void;
  tableProps?: React.ComponentProps<typeof Table> & {
    [attr: `data-${string}`]: string;
  };
  enableRowSelection?: boolean;
  onRowSelectionChange?: (rows: T[]) => void;
  getRowId?: (originalRow: T, index: number) => string;
}

function DataTable<T extends object>({
  data,
  columns,
  renderSubComponent,
  pageIndex,
  pageSize,
  pageCount,
  onPaginationChange,
  tableProps,
  enableRowSelection,
  onRowSelectionChange,
  getRowId,
}: ReactTableProps<T>) {
  const { t } = useTranslation('common');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: pageIndex ?? 0,
    pageSize: pageSize ?? 15,
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const navigateToPage = useNavigateToNewPage();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
    enableRowSelection: Boolean(enableRowSelection),
    getRowId,
    pageCount,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onPaginationChange: (updater) => {
      const navigate = (page: number) => setTimeout(() => navigateToPage(page));

      if (typeof updater === 'function') {
        setPagination((prevState) => {
          const nextState = updater(prevState);

          if (onPaginationChange) {
            onPaginationChange(nextState);
          } else {
            navigate(nextState.pageIndex);
          }

          return nextState;
        });
      } else {
        setPagination(updater);

        if (onPaginationChange) {
          onPaginationChange(updater);
        } else {
          navigate(updater.pageIndex);
        }
      }
    },
  });

  useEffect(() => {
    if (!enableRowSelection || !onRowSelectionChange) {
      return;
    }

    const selectedRows = table
      .getSelectedRowModel()
      .rows.map((row) => row.original as T);

    onRowSelectionChange(selectedRows);
  }, [enableRowSelection, onRowSelectionChange, table, rowSelection]);

  const selectionEnabled = Boolean(enableRowSelection);

  return (
    <div
      className={'border border-gray-50 dark:border-dark-800 rounded-md p-1'}
    >
      <Table {...tableProps}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {selectionEnabled ? (
                <TableHead className="w-[48px]">
                  <Checkbox
                    aria-label={t('table.selectAllRows')}
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) =>
                      table.toggleAllPageRowsSelected(Boolean(value))
                    }
                    className="mx-auto"
                  />
                </TableHead>
              ) : null}
              {headerGroup.headers.map((header) => (
                <TableHead
                  colSpan={header.colSpan}
                  style={{
                    width: header.column.getSize(),
                  }}
                  key={header.id}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={classNames({
                  'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted':
                    row.getIsExpanded(),
                })}
              >
                {selectionEnabled ? (
                  <TableCell className="w-[48px]">
                    <Checkbox
                      aria-label={t('table.selectRow')}
                      checked={row.getIsSelected()}
                      disabled={!row.getCanSelect()}
                      onCheckedChange={(value) =>
                        row.toggleSelected(Boolean(value))
                      }
                      className="mx-auto"
                    />
                  </TableCell>
                ) : null}
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    style={{
                      width: cell.column.getSize(),
                    }}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>

              {renderSubComponent ? (
                <TableRow key={row.id + '-expanded'}>
                  <TableCell colSpan={columns.length + (selectionEnabled ? 1 : 0)}>
                    {renderSubComponent({ row })}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={columns.length + (selectionEnabled ? 1 : 0)}>
              <Pagination table={table} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function Pagination<T>({
  table,
}: React.PropsWithChildren<{
  table: ReactTable<T>;
}>) {
  return (
    <div className="flex items-center gap-2 w-full">
      <IconButton
        onClick={() => table.setPageIndex(0)}
        disabled={!table.getCanPreviousPage()}
      >
        <ChevronDoubleLeftIcon className={'h-4'} />
      </IconButton>

      <IconButton
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <ChevronLeftIcon className={'h-4'} />
      </IconButton>

      <IconButton
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <ChevronRightIcon className={'h-4'} />
      </IconButton>

      <IconButton
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        <ChevronDoubleRightIcon className={'h-4'} />
      </IconButton>

      <span className="flex items-center text-sm">
        <Trans
          i18nKey={'common:pageOfPages'}
          values={{
            page: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount(),
          }}
        />
      </span>
    </div>
  );
}

export default DataTable;

/**
 * Navigates to a new page using the provided page index and optional page parameter.
 */
function useNavigateToNewPage(
  props: { pageParam?: string } = {
    pageParam: 'page',
  },
) {
  const router = useRouter();
  const param = props.pageParam ?? 'page';

  return useCallback(
    (pageIndex: number) => {
      const url = new URL(window.location.href);
      url.searchParams.set(param, String(pageIndex + 1));

      router.push(url.pathname + url.search);
    },
    [param, router],
  );
}
