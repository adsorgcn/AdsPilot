export type StatItem = {
  label: string;
  value: string;
  badge?: string;
  highlight?: boolean;
};

type StatGridProps = {
  items: StatItem[];
  columns?: 1 | 2 | 3;
};

export function StatGrid({ items, columns = 3 }: StatGridProps) {
  const columnClass =
    columns === 1
      ? ''
      : columns === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 gap-4 ${columnClass}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border/60 bg-muted/10 p-4"
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p
            className={`mt-2 text-xl font-semibold ${
              item.highlight ? 'text-primary' : 'text-foreground'
            }`}
          >
            {item.value}
          </p>
          {item.badge ? (
            <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
              {item.badge}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
