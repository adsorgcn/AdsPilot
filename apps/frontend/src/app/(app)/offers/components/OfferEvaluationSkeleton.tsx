import Skeleton from '~/core/ui/Skeleton';

/**
 * @name OfferEvaluationSkeleton
 * @description Loading skeleton for evaluation results
 *
 * Ref: frontend-package-offer-evaluation.md - Task A2-5
 */
export function OfferEvaluationSkeleton() {
  return (
    <div className={'flex flex-col space-y-4 animate-pulse'}>
      {/* Evaluation Meta Info Skeleton */}
      <div
        className={
          'flex items-center justify-between rounded-md border border-border bg-muted/40 p-3'
        }
      >
        <Skeleton className={'h-5 w-24'} />
        <Skeleton className={'h-4 w-32'} />
      </div>

      {/* Final Score Skeleton */}
      <div
        className={
          'rounded-lg border border-border bg-background p-4 text-center'
        }
      >
        <Skeleton className={'mx-auto h-4 w-20'} />
        <Skeleton className={'mx-auto mt-3 h-10 w-16'} />
        <Skeleton className={'mx-auto mt-2 h-3 w-12'} />
      </div>

      {/* SimilarWeb Data Skeleton */}
      <div className={'space-y-3'}>
        <Skeleton className={'h-5 w-40'} />

        <div className={'grid gap-3 sm:grid-cols-2'}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={'rounded-md border border-border bg-background p-3'}
            >
              <Skeleton className={'h-3 w-16'} />
              <Skeleton className={'mt-2 h-6 w-24'} />
            </div>
          ))}
        </div>

        {/* Traffic Sources Skeleton */}
        <div className={'rounded-lg border border-border bg-background p-4'}>
          <Skeleton className={'mb-3 h-4 w-32'} />
          <div className={'space-y-2'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={'flex items-center gap-3'}>
                <Skeleton className={'h-3 w-16'} />
                <div className={'flex-1'}>
                  <Skeleton className={'h-2 w-full rounded-full'} />
                </div>
                <Skeleton className={'h-3 w-12'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OfferEvaluationSkeleton;
