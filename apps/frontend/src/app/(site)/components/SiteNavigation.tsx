import Link from 'next/link';
import Bars3Icon from '@heroicons/react/24/outline/Bars3Icon';

import NavigationMenuItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

const links = {
  Features: {
    label: '功能亮点',
    path: '/features',
  },
  HighValueOffers: {
    label: '高价值Offer',
    path: '/high-value-offers',
  },
  Pricing: {
    label: '定价',
    path: '/pricing',
  },
  Resources: {
    label: '资源',
    path: '/resources',
  },
  Support: {
    label: '支持中心',
    path: '/support',
  },
  Docs: {
    label: '文档',
    path: '/docs',
  },
};

const SiteNavigation = () => {
  const className = 'font-semibold';

  return (
    <>
      <div className={'hidden items-center space-x-0.5 lg:flex'}>
        <NavigationMenu>
          <NavigationMenuItem className={className} link={links.Features} />
          <NavigationMenuItem className={className} link={links.HighValueOffers} />
          <NavigationMenuItem className={className} link={links.Pricing} />
          <NavigationMenuItem className={className} link={links.Resources} />
          <NavigationMenuItem className={className} link={links.Support} />
          <NavigationMenuItem className={className} link={links.Docs} />
        </NavigationMenu>
      </div>

      <div className={'flex items-center lg:hidden'}>
        <MobileDropdown />
      </div>
    </>
  );
};

function MobileDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={'Open Menu'}>
        <Bars3Icon className={'h-9'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {Object.values(links).map((item) => {
          const className = 'flex w-full h-full items-center';

          return (
            <DropdownMenuItem key={item.path}>
              <Link className={className} href={item.path}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SiteNavigation;
