import Image from 'next/image';
import classNames from 'clsx';

import configuration from '~/configuration';

type LogoImageProps = {
  className?: string;
  priority?: boolean;
};

const LogoImage = ({ className, priority }: LogoImageProps) => {
  return (
    <Image
      src="/assets/images/favicon/logo.png"
      alt={configuration.site.siteName}
      width={1954}
      height={116}
      sizes="(max-width: 768px) 160px, 220px"
      className={classNames('h-auto w-40 sm:w-56', className)}
      priority={priority}
    />
  );
};

export default LogoImage;
