import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface UserPageBreadcrumbsProps {
  displayName: string;
}

export default function UserPageBreadcrumbs({ displayName }: UserPageBreadcrumbsProps) {
  return (
    <div className={'flex space-x-1 items-center text-xs p-2'}>
      <Link href={'/admin'}>Admin</Link>
      <ChevronRightIcon className={'w-3'} />
      <Link href={'/admin/users'}>Users</Link>
      <ChevronRightIcon className={'w-3'} />
      <span>{displayName}</span>
    </div>
  );
}
