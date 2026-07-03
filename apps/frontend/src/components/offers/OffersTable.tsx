'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Trash2 } from 'lucide-react';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { EvaluateButton } from './EvaluateButton';
import dynamic from 'next/dynamic';
import type { Offer as OfferEntity, OfferEvaluation } from '~/lib/offers/types';

// ✅ 懒加载AI相关组件 - 减少核心表格包体积
const AIScoreBadge = dynamic(
  () => import('./AIScoreBadge').then(mod => ({ default: mod.AIScoreBadge })),
  {
    loading: () => <div className="h-6 w-12 animate-pulse rounded bg-muted" />,
    ssr: false
  }
);

const AIEvaluationDialog = dynamic(
  () => import('./AIEvaluationDialog').then(mod => ({ default: mod.AIEvaluationDialog })),
  {
    loading: () => <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />,
    ssr: false
  }
);

const EvaluationProgressDialog = dynamic(
  () => import('./EvaluationProgressDialog').then(mod => ({ default: mod.EvaluationProgressDialog })),
  {
    loading: () => <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />,
    ssr: false
  }
);

interface OffersTableProps {
  offers: OfferEntity[];
  isLoading: boolean;
  selectedIds?: Set<string>;
  onToggle?: (...args: any[]) => void;
  onToggleAll?: (...args: any[]) => void;
  onView: (offer: OfferEntity) => void;
  onEvaluate?: (offer: OfferEntity) => void;
  onDelete: (offer: OfferEntity) => void;
  onToggleFavorite?: (offer: OfferEntity) => void;
  pendingActionIds?: Set<string>;
  syncStatusMap?: Map<string, unknown>;
}

/**
 * FE-023: Enhanced OffersTable with AI recommendation score column
 */
export function OffersTable({
  offers,
  isLoading,
  onView,
  onDelete,
}: OffersTableProps) {
  const { t } = useTranslation('common');
  const [evaluationDialogOfferId, setEvaluationDialogOfferId] = useState<string | null>(null);
  const [activeEvaluationId, setActiveEvaluationId] = useState<string | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">
          {t('offers.loading', 'Loading offers...')}
        </div>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">
          {t('offers.noOffers', 'No offers found')}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="p-4 text-left text-sm font-medium">
                  {t('offers.table.name', 'Name')}
                </th>
                <th className="p-4 text-left text-sm font-medium">
                  {t('offers.table.url', 'URL')}
                </th>
                <th className="p-4 text-left text-sm font-medium">
                  {t('offers.table.status', 'Status')}
                </th>
                <th className="p-4 text-left text-sm font-medium">
                  {t('offers.table.aiScore', 'AI Score')}
                </th>
                <th className="p-4 text-left text-sm font-medium">
                  {t('offers.table.created', 'Created')}
                </th>
                <th className="p-4 text-right text-sm font-medium">
                  {t('offers.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-sm">
                      {offer.name ?? offer.brandName ?? t('offers.table.unknownName', 'Unnamed')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {offer.url}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={offer.status === 'active' ? 'default' : 'secondary'}>
                      {offer.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {renderAIScore(
                      offer.latestEvaluation,
                      () => setEvaluationDialogOfferId(offer.id),
                      t
                    )}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(offer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(offer)}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        {t('offers.actions.view', 'View')}
                      </Button>
                      <EvaluateButton
                        offerId={offer.id}
                        offerName={offer.name ?? offer.brandName ?? offer.url}
                        variant="ghost"
                        size="sm"
                        onEvaluationStarted={(evaluationId) => {
                          // Open progress dialog
                          setActiveEvaluationId(evaluationId);
                          setProgressDialogOpen(true);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(offer)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Evaluation Dialog */}
      {evaluationDialogOfferId && (
        <AIEvaluationDialog
          offerId={evaluationDialogOfferId}
          open={!!evaluationDialogOfferId}
          onClose={() => setEvaluationDialogOfferId(null)}
        />
      )}

      {/* Evaluation Progress Dialog (FE-028) */}
      <EvaluationProgressDialog
        evaluationId={activeEvaluationId}
        open={progressDialogOpen}
        onClose={() => {
          setProgressDialogOpen(false);
          setActiveEvaluationId(null);
        }}
        onCompleted={() => {
          // Refresh offers list (implement refetch)
          setProgressDialogOpen(false);
          setActiveEvaluationId(null);
        }}
      />
    </>
  );
}

function getRecommendationScore(evaluation?: OfferEvaluation | null): number | null {
  if (!evaluation) {
    return null;
  }

  if (typeof evaluation.aiRecommendationScore === 'number') {
    return evaluation.aiRecommendationScore;
  }

  if (typeof evaluation.aiAnalysis?.recommendationScore === 'number') {
    return evaluation.aiAnalysis.recommendationScore;
  }

  return null;
}

function renderAIScore(
  evaluation: OfferEvaluation | null | undefined,
  onClick: () => void,
  translate: (key: string, defaultValue: string) => string,
) {
  const score = getRecommendationScore(evaluation);

  if (score === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {translate('offers.table.notEvaluated', 'Not evaluated')}
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className="cursor-pointer hover:opacity-80 transition-opacity"
    >
      <AIScoreBadge score={score} size="sm" />
    </button>
  );
}
