import Spinner from './Spinner';

function LoadingSpinner(
  props: React.PropsWithChildren<{
    className?: string;
    size?: 'sm' | 'md' | 'lg';
  }>,
) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <Spinner
      className={`${sizeClasses[props.size || 'md']} ${props.className || ''}`}
    />
  );
}

export default LoadingSpinner;