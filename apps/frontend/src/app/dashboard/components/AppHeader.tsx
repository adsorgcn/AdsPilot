import { PageHeader } from '~/core/ui/Page';
import Breadcrumbs, { type BreadcrumbItem } from '~/core/ui/Breadcrumbs';

const AppHeader: React.FCC<{
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}> = ({ children, title, description, breadcrumbs }) => {
  return (
    <div className="flex flex-col gap-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}

      <PageHeader
        title={title}
        description={description}
      >
        {children}
      </PageHeader>
    </div>
  );
};

export default AppHeader;
