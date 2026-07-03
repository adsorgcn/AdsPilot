import type { ReactNode } from 'react';

type ListSectionProps = {
  title: string;
  children: ReactNode;
};

export function ListSection({ title, children }: ListSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}
