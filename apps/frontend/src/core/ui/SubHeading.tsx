import { createElement } from 'react';
import classNames from 'clsx';

const SubHeading = ({
  children,
  className,
  as = 'h2',
}: React.PropsWithChildren<{
  className?: string;
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
}>) => {
  const span = (
    <span
      className={classNames(
        'flex flex-col space-y-1 text-xl lg:text-2xl font-normal text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );

  return createElement(as, {}, span);
};

export default SubHeading;
