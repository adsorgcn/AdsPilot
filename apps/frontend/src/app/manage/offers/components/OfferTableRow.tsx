import StatusBadge from '~/core/ui/StatusBadge';
import ScoreDisplay from '~/core/ui/ScoreDisplay';
import type { Offer } from '~/lib/api/types/console';

import { currencyFormatter } from '../utils/formatters';

interface OfferTableRowProps {
  offer: Offer;
  checked: boolean;
  onToggle: (offerId: string, checked: boolean) => void;
}

export function OfferTableRow({
  offer,
  checked,
  onToggle,
}: OfferTableRowProps) {
  return (
    <tr className="border-b border-border/80 hover:bg-muted/40">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
          checked={checked}
          onChange={(event) => onToggle(offer.id, event.target.checked)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {offer.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {offer.originalUrl}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <StatusBadge status={offer.status} />
      </td>
      <td className="px-4 py-3 text-sm">
        <ScoreDisplay score={offer.siterankScore ?? 0} />
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {currencyFormatter.format(offer.totalRevenue ?? 0)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {offer.createdAt
          ? new Date(offer.createdAt).toLocaleDateString()
          : '--'}
      </td>
    </tr>
  );
}
