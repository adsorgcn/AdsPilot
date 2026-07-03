import classNames from 'clsx';

function Divider({
  className,
}: {
  className?: string;
}) {
  return (
    <hr
      className={classNames(
        'w-full border border-border',
        className,
      )}
    />
  );
}

export default Divider;
