import Image from 'next/image';
import cn from 'clsx';

type Props = {
  title: string;
  src: string;
  preloadImage?: boolean;
  className?: string;
};

const CoverImage: React.FC<Props> = ({
  title,
  src,
  preloadImage,
  className,
}) => {
  return (
    <Image
      className={cn(
        'duration-250 block rounded-xl object-cover' +
          ' transition-all hover:opacity-90',
        {
          className,
        }
      )}
      src={src}
      priority={preloadImage}
      alt={`Cover Image for ${title}`}
      fill
    />
  );
};

export default CoverImage;
