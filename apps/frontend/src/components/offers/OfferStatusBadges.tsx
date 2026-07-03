'use client';

import { useTranslation } from 'react-i18next';
import Badge from '~/core/ui/Badge';
import { CheckCircle, XCircle, Clock, Archive, Rocket, Link } from 'lucide-react';

export interface OfferStatus {
  evaluation: 'not_evaluated' | 'evaluated' | 'failed';
  click: 'not_configured' | 'configured';
  deployment: 'not_deployed' | 'deployed' | 'paused';
  archived: boolean;
}

interface OfferStatusBadgesProps {
  status: OfferStatus;
  compact?: boolean;
  className?: string;
}

/**
 * Multi-dimensional status badges for offer lifecycle
 * Design reference: design.md lines 1887-1907
 */
export function OfferStatusBadges({
  status,
  compact = false,
  className = '',
}: OfferStatusBadgesProps) {
  const { t } = useTranslation();

  // Archived status takes priority
  if (status.archived) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="gap-1">
          <Archive className="h-3 w-3" />
          {!compact && t('offers.status.archived', 'Archived')}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Evaluation Status */}
      {status.evaluation === 'evaluated' ? (
        <Badge variant="default" className="gap-1 bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3" />
          {!compact && t('offers.status.evaluated', 'Evaluated')}
        </Badge>
      ) : status.evaluation === 'failed' ? (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {!compact && t('offers.status.evalFailed', 'Eval Failed')}
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-700">
          <Clock className="h-3 w-3" />
          {!compact && t('offers.status.notEvaluated', 'Not Evaluated')}
        </Badge>
      )}

      {/* Click Tracking Status */}
      {status.click === 'configured' && (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          <Link className="h-3 w-3" />
          {!compact && t('offers.status.clickConfigured', 'Tracked')}
        </Badge>
      )}

      {/* Deployment Status */}
      {status.deployment === 'deployed' ? (
        <Badge variant="default" className="gap-1 bg-purple-100 text-purple-800 border-purple-200">
          <Rocket className="h-3 w-3" />
          {!compact && t('offers.status.deployed', 'Deployed')}
        </Badge>
      ) : status.deployment === 'paused' ? (
        <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3" />
          {!compact && t('offers.status.paused', 'Paused')}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Compact status indicator for table cells
 */
export function OfferStatusCompact({ status }: { status: OfferStatus }) {
  if (status.archived) return <Badge variant="secondary">Archived</Badge>;

  // Priority: deployment > evaluation > click
  if (status.deployment === 'deployed') {
    return <Badge className="bg-purple-100 text-purple-800">Active</Badge>;
  }

  if (status.evaluation === 'evaluated') {
    return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
  }

  if (status.evaluation === 'failed') {
    return <Badge variant="destructive">Failed</Badge>;
  }

  return <Badge variant="secondary">Pending</Badge>;
}
