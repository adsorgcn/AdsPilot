'use client';

import {
  HomeIcon,
  UserIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  RectangleStackIcon,
  MegaphoneIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import Sidebar, { SidebarContent, SidebarItem } from '~/core/ui/Sidebar';
import Logo from '~/core/ui/Logo';

function AdminSidebar() {
  return (
    <Sidebar>
      <SidebarContent className={'mt-4 mb-8 pt-2'}>
        <Logo href={'/manage'} />
      </SidebarContent>

      <SidebarContent>
        <SidebarItem
          end
          path={'/manage'}
          Icon={() => <HomeIcon className={'h-6'} />}
        >
          Dashboard
        </SidebarItem>

        <SidebarItem
          path={'/manage/users'}
          Icon={() => <UserIcon className={'h-6'} />}
        >
          Users
        </SidebarItem>

        <SidebarItem
          path={'/manage/tokens'}
          Icon={() => <CurrencyDollarIcon className={'h-6'} />}
        >
          Token Management
        </SidebarItem>

        <SidebarItem
          path={'/manage/offers'}
          Icon={() => <ShoppingBagIcon className={'h-6'} />}
        >
          Offer Management
        </SidebarItem>

        <SidebarItem
          path={'/manage/subscriptions'}
          Icon={() => <CreditCardIcon className={'h-6'} />}
        >
          Subscriptions
        </SidebarItem>

        <SidebarItem
          path={'/manage/tasks'}
          Icon={() => <RectangleStackIcon className={'h-6'} />}
        >
          Task Management
        </SidebarItem>

        <SidebarItem
          path={'/manage/ads-accounts'}
          Icon={() => <MegaphoneIcon className={'h-6'} />}
        >
          Ads Accounts
        </SidebarItem>

        <SidebarItem
          path={'/manage/financial'}
          Icon={() => <BanknotesIcon className={'h-6'} />}
        >
          Financial Reports
        </SidebarItem>

        <SidebarItem
          path={'/manage/security'}
          Icon={() => <ShieldCheckIcon className={'h-6'} />}
        >
          Security
        </SidebarItem>
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;
