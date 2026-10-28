import { Star } from 'lucide-react';
import { cx } from './cx';

interface StarRatingProps {
  stars: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-8' } as const;

/** Zero to three stars, read out as “2 of 3 stars”. */
export function StarRating({ stars, size = 'md', className }: StarRatingProps) {
  return (
    <span
      role="img"
      aria-label={`${stars} of 3 stars`}
      className={cx('inline-flex shrink-0 gap-0.5', className)}
    >
      {[1, 2, 3].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cx(
            SIZES[size],
            star <= stars ? 'fill-warning text-warning' : 'text-border-strong',
          )}
        />
      ))}
    </span>
  );
}
