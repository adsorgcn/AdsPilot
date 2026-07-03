'use client';

import { useTranslation } from 'react-i18next';

import Badge from '~/core/ui/Badge';

import type { OfferStatus } from '~/lib/offers';

const STATUS_COLOR: Record<OfferStatus, React.ComponentProps<typeof Badge>['color']> = {
  pending_evaluation: 'info',
  evaluating: 'info',
  evaluation_failed: 'error',
  evaluated: 'success',
  click_task_running: 'info',
  ready_to_deploy: 'success',
  deploying: 'info',
  deployed: 'success',
  archived: 'warn',
};

type Props = {
  status: OfferStatus;
};

function OfferStatusBadge({ status }: Props) {
  const { t } = useTranslation('common');
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.evaluating;

  return (
    <Badge color={color} size={'small'}>
      {t(`offers.status.${status}`)}
    </Badge>
  );
}

export default OfferStatusBadge;
