'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
import Trans from '~/core/ui/Trans';

interface Column<T> {
  id: string;
  header: string | React.ReactNode;
  cell: (row: T) => React.ReactNode;
  size?: number;
}

interface SimpleDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  tableProps?: React.ComponentProps<typeof Table>;
}

function SimpleDataTable<T>({
  data,
  columns,
  pageIndex = 0,
  pageSize = 15,
  pageCount = 1,
  onPageChange,
  tableProps,
}: SimpleDataTableProps<T>) {
  const { t } = useTranslation('common');
  const router = useRouter();

  const handlePageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(newPage + 1));
      router.push(url.pathname + url.search);
    }
  };

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  return (
    <div className={'border border-gray-50 dark:border-dark-800 rounded-md p-1'}>
      <Table {...tableProps}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                style={column.size ? { width: column.size } : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  style={column.size ? { width: column.size } : undefined}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={columns.length}>
              <div className="flex items-center gap-2 w-full">
                <IconButton
                  onClick={() => handlePageChange(0)}
                  disabled={!canPreviousPage}
                >
                  <ChevronDoubleLeftIcon className={'h-4'} />
                </IconButton>

                <IconButton
                  onClick={() => handlePageChange(pageIndex - 1)}
                  disabled={!canPreviousPage}
                >
                  <ChevronLeftIcon className={'h-4'} />
                </IconButton>

                <IconButton
                  onClick={() => handlePageChange(pageIndex + 1)}
                  disabled={!canNextPage}
                >
                  <ChevronRightIcon className={'h-4'} />
                </IconButton>

                <IconButton
                  onClick={() => handlePageChange(pageCount - 1)}
                  disabled={!canNextPage}
                >
                  <ChevronDoubleRightIcon className={'h-4'} />
                </IconButton>

                <span className="flex items-center text-sm">
                  <Trans
                    i18nKey={'common:pageOfPages'}
                    values={{
                      page: pageIndex + 1,
                      total: pageCount,
                    }}
                  />
                </span>
              </div>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default SimpleDataTable;
export type { Column };
