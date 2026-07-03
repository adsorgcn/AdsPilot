"use client";

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import Spinner from '~/core/ui/Spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import Badge from '~/core/ui/Badge';

import { useOffer, useOfferEvaluationHistory } from '~/lib/offers';
import type { OfferEvaluation } from '~/lib/offers/types';

import OfferStatusBadge from './OfferStatusBadge';
import OfferEvaluationSection from './OfferEvaluationSection';
import OfferEvaluationSkeleton from './OfferEvaluationSkeleton';
import OfferEvaluationError from './OfferEvaluationError';
import { OfferMetadata } from './OfferMetadata';
import { OfferEvaluationHistoryList } from './OfferEvaluationHistoryList';
import { formatRelativeTime } from '../utils/format';

type Maybe<T> = T | null | undefined;

type Props = {
  offerId: string | null;
  open: boolean;
  onClose: () => void;
};

function OfferDetailDialog({ offerId, open, onClose }: Props) {
  const { t } = useTranslation('common');
  const { offer: offerData, isLoading, refetch: mutate } = useOffer(offerId ?? undefined);
  const offer = offerData as any;
  const [historyLimit, setHistoryLimit] = useState(5);
  const {
    history,
    isLoading: historyLoading,
    refetch: refreshHistory,
  } = useOfferEvaluationHistory(offerId ?? undefined, historyLimit);

  const latestEvaluation = useMemo(() => {
    if (Array.isArray(history) && history.length > 0) {
      return history[0];
    }

    return offer?.latestEvaluation ?? null;
  }, [history, offer]);

  const [activeTab, setActiveTab] = useState<'latest' | 'history'>(
    latestEvaluation ? 'latest' : 'history',
  );

  useEffect(() => {
    if (!latestEvaluation && Array.isArray(history) && history.length > 0) {
      setActiveTab('history');
    }
  }, [latestEvaluation, history]);

  useEffect(() => {
    setHistoryLimit(5);
  }, [offerId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={'sm:max-w-3xl max-h-[90vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle>{offer?.brandName ?? t('offers.detail.title')}</DialogTitle>
          <DialogDescription>
            {t('offers.detail.description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className={'flex min-h-[220px] items-center justify-center'}>
            <Spinner className={'text-primary'} />
          </div>
        ) : offer ? (
          <div className={'flex flex-col space-y-5 py-2'}>
            {/* Status badges */}
            <div className={'flex flex-wrap items-center gap-3'}>
              <OfferStatusBadge status={offer.status} />

              {typeof offer.healthScore === 'number' ? (
                <Badge size={'small'} color={'info'}>
                  {t('offers.detail.aiScoreBadge', { score: offer.healthScore })}
                </Badge>
              ) : null}

              <span className={'text-xs text-muted-foreground'}>
                {t('offers.detail.lastUpdatedLabel')} {formatRelativeTime(offer.updatedAt ?? offer.createdAt, t)}
              </span>
            </div>

            {/* Metadata */}
            <OfferMetadata offer={offer} />

            {/* Status reason */}
            {offer.statusReason ? (
              <div className={'rounded-md bg-muted/60 p-3 text-sm text-muted-foreground'}>
                {offer.statusReason}
              </div>
            ) : null}

            {/* Tabs */}
            <div className={'flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2'}>
              <div className={'flex items-center gap-2'}>
                <Button
                  size={'sm'}
                  variant={activeTab === 'latest' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('latest')}
                  disabled={!latestEvaluation}
                >
                  {t('offers.detail.latestEvaluation')}
                </Button>
                <Button
                  size={'sm'}
                  variant={activeTab === 'history' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('history')}
                >
                  {t('offers.detail.historyTab')}
                </Button>
              </div>

              {activeTab === 'history' && Array.isArray(history) && history.length >= historyLimit ? (
                <Button
                  size={'sm'}
                  variant={'outline'}
                  onClick={() => setHistoryLimit((prev) => prev + 5)}
                >
                  {t('offers.detail.loadMore')}
                </Button>
              ) : null}
            </div>

            {/* Tab content */}
            {activeTab === 'latest'
              ? renderEvaluationContent(
                  offer,
                  latestEvaluation ?? undefined,
                  offer.status === 'evaluating',
                  isLoading || historyLoading,
                  () => {
                    mutate();
                    refreshHistory();
                  },
                  t,
                )
              : (
                  <OfferEvaluationHistoryList
                    items={history as any}
                    isLoading={historyLoading}
                  />
                )}
          </div>
        ) : (
          <div className={'flex min-h-[220px] items-center justify-center text-sm text-muted-foreground'}>
            {t('offers.detail.notFound')}
          </div>
        )}

        <DialogFooter>
          <Button variant={'ghost'} onClick={onClose}>
            {t('offers.detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderEvaluationContent(
  offer: NonNullable<ReturnType<typeof useOffer>['offer']>,
  evaluation: Maybe<OfferEvaluation>,
  isEvaluating: boolean,
  isLoading: boolean,
  onRetry: () => void,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (isLoading) {
    return (
      <div className={'flex min-h-[180px] items-center justify-center'}>
        <Spinner className={'text-primary'} />
      </div>
    );
  }

  if (isEvaluating) {
    return (
      <div className={'border-t border-border pt-4'}>
        <h3 className={'mb-3 text-base font-semibold text-foreground'}>
          {t('offers.detail.latestEvaluationResult')}
        </h3>
        <OfferEvaluationSkeleton />
      </div>
    );
  }

  const hasFailed =
    (offer as any).status === 'evaluation_failed' || evaluation?.status === 'failed';

  if (hasFailed) {
    const errorMessage =
      evaluation?.errorMessage ?? (offer as any).statusReason ?? t('offers.detail.evaluationErrorDefault');

    return (
      <div className={'border-t border-border pt-4'}>
        <h3 className={'mb-3 text-base font-semibold text-foreground'}>
          {t('offers.detail.latestEvaluationResult')}
        </h3>
        <OfferEvaluationError message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  if (evaluation) {
    return (
      <div className={'border-t border-border pt-4'}>
        <h3 className={'mb-3 text-base font-semibold text-foreground'}>
          {t('offers.detail.latestEvaluationResult')}
        </h3>
        <OfferEvaluationSection evaluation={evaluation} />
      </div>
    );
  }

  return (
    <div
      className={
        'rounded-md border border-dashed border-border bg-muted/30 p-6 text-center'
      }
    >
      <p className={'text-sm text-muted-foreground'}>
        {t('offers.detail.notEvaluatedYet')}
      </p>
    </div>
  );
}

export default OfferDetailDialog;
