import Badge from '~/core/ui/Badge';
import { Card, CardContent } from '~/components/ui/card';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down';
  badge?: { label: string; color: 'info' | 'success' | 'error' };
  onClick?: () => void;
  testId?: string;
  t: (key: string) => string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  badge,
  onClick,
  testId,
  t,
}: StatCardProps) {
  return (
    <Card
      hoverable={!!onClick}
      className="cursor-pointer"
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          </div>

          {badge && (
            <Badge size="small" color={badge.color}>
              {badge.label}
            </Badge>
          )}
        </div>

        {trend && (
          <div className="mt-2 text-xs text-muted-foreground">
            <ArrowTrendingUpIcon className="inline h-3 w-3" />
            <span className="ml-1">{t('dashboard.stats.active')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
