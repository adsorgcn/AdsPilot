import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import { PageHeader } from '~/core/ui/Page';
import Breadcrumbs, { type BreadcrumbItem } from '~/core/ui/Breadcrumbs';

function AdminHeader({
  children,
  breadcrumbs,
}: React.PropsWithChildren<{
  breadcrumbs?: BreadcrumbItem[];
}>) {
  return (
    <div className="flex flex-col gap-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}

      <PageHeader title={children}>
        <Button variant={'ghost'} href={'/dashboard'}>
          <span className={'flex space-x-2.5 items-center'}>
            <ArrowLeftIcon className={'w-4 h-4'} />

            <span>Back to App</span>
          </span>
        </Button>
      </PageHeader>
    </div>
  );
}

export default AdminHeader;
