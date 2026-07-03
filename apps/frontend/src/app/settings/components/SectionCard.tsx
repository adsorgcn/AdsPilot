import type { ReactNode } from 'react';
import Heading from '~/core/ui/Heading';

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  actions,
  children,
}: SectionCardProps) {
  return (
    <div className="space-y-6 rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Heading type={3}>{title}</Heading>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
