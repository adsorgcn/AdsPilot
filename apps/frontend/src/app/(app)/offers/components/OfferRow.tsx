"use client";

import { type MouseEvent, useMemo } from 'react';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import IconButton from '~/core/ui/IconButton';
import { Checkbox } from '~/core/ui/Checkbox';

import type { Offer } from '~/lib/offers';
import type { OfferSyncResult } from '~/lib/tasks/offer-sync';

import OfferStatusBadge from './OfferStatusBadge';
import EvaluateButton from './EvaluateButton';
import { renderScoreBadge, renderSyncBadge } from './OfferBadges';
import { formatRelativeTime } from '../utils/format';

type OfferRowProps = {
  offer: Offer;
  selected: boolean;
  isPending: boolean;
  isLast: boolean;
  onToggle: (offerId: string, selected: boolean) => void;
  onView: (offer: Offer) => void;
  onEvaluate: (offer: Offer) => void;
  onDelete: (offer: Offer) => void;
  onToggleFavorite: (offer: Offer, nextValue: boolean) => void;
  syncStatus?: OfferSyncResult;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export function OfferRow({
  offer,
  selected,
  isPending,
  isLast,
  onToggle,
  onView,
  onEvaluate,
  onDelete,
  onToggleFavorite,
  syncStatus,
  t,
}: OfferRowProps) {
  const isFavorite = offer.isFavorite;
  const FavoriteIcon = isFavorite ? StarIconSolid : StarIconOutline;
  const updatedAt = offer.lastEvaluatedAt ?? offer.updatedAt ?? offer.createdAt;

  const rowClassName = useMemo(() => {
    const base =
      'flex flex-col gap-3 border-b border-border bg-background px-4 py-4 transition hover:bg-muted/40 lg:grid lg:grid-cols-[3rem_minmax(260px,1fr)_140px_150px_150px_140px_120px_160px] lg:items-center lg:gap-4';
    return isLast ? base.replace('border-b border-border', 'border-b-0') : base;
  }, [isLast]);

  return (
    <div className={rowClassName}>
      <div className="flex items-start lg:items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggle(offer.id, checked === true)}
          aria-label={t('offers.table.selectOfferAria', { brandName: offer.brandName })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            aria-pressed={isFavorite}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onToggleFavorite(offer, !isFavorite);
            }}
            title={isFavorite ? t('offers.table.removeFavorite') : t('offers.table.addFavorite')}
            className="h-8 w-8"
          >
            <FavoriteIcon
              className={`h-4 w-4 ${isFavorite ? 'text-amber-500' : 'text-muted-foreground'}`}
            />
          </IconButton>

          <button
            type="button"
            onClick={() => onView(offer)}
            className="text-left text-sm font-semibold text-foreground hover:text-primary"
          >
            {offer.brandName}
          </button>

          {typeof offer.healthScore === 'number' ? (
            <Badge size="small" color="info">
              AI
            </Badge>
          ) : null}

          <div className="flex lg:hidden">
            <OfferStatusBadge status={offer.status} />
          </div>
        </div>

        <a
          href={offer.url}
          target="_blank"
          rel="noreferrer"
          className="max-w-full truncate text-xs text-primary underline-offset-4 hover:underline"
        >
          {offer.url}
        </a>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelativeTime(updatedAt, t)}</span>
          {offer.statusReason ? (
            <>
              <span>·</span>
              <span className="max-w-[320px] truncate">{offer.statusReason}</span>
            </>
          ) : null}
        </div>

        <div className="lg:hidden">
          {renderSyncBadge(syncStatus, t)}
        </div>
      </div>

      <div className="hidden lg:block">
        <OfferStatusBadge status={offer.status} />
      </div>

      <div className="hidden lg:flex justify-center">
        {renderScoreBadge(offer.lastEvaluationScore ?? offer.healthScore)}
      </div>

      <div className="hidden lg:block">
        {renderSyncBadge(syncStatus, t)}
      </div>

      <div className="hidden lg:block text-sm text-muted-foreground">
        {formatRelativeTime(updatedAt, t)}
      </div>

      <div className="hidden lg:block text-sm text-muted-foreground">
        {offer.country ?? '--'}
      </div>

      <div className="flex justify-end gap-2">
        <EvaluateButton
          offer={offer}
          onSuccess={() => onEvaluate(offer)}
          disabled={isPending}
        />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(offer)}
          disabled={isPending}
        >
          {t('offers.table.deleteAction')}
        </Button>
      </div>
    </div>
  );
}
