import Image from 'next/image';
import classNames from 'clsx';

type LogoImageMiniProps = {
  className?: string;
};

const LogoImageMini = ({ className }: LogoImageMiniProps) => {
  return (
    <Image
      src="/assets/images/favicon/logo.png"
      alt="Google-Monetize"
      width={1954}
      height={116}
      sizes="96px"
      className={classNames('h-auto w-20', className)}
    />
  );
};

export default LogoImageMini;
