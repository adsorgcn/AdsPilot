export type Tone = 'success' | 'warn' | 'info';

export type SimpleListItem = {
  id: string;
  primary: string;
  secondary?: string;
  value?: string;
  tag?: {
    label: string;
    tone?: Tone;
  };
};

type SimpleListProps = {
  items: SimpleListItem[];
  emptyText: string;
};

function toneToClass(tone?: Tone) {
  switch (tone) {
    case 'success':
      return 'bg-green-100 text-green-700';
    case 'warn':
      return 'bg-yellow-100 text-yellow-700';
    case 'info':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function SimpleList({ items, emptyText }: SimpleListProps) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {item.primary}
            </p>
            {item.secondary ? (
              <p className="text-xs text-muted-foreground">{item.secondary}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            {item.value ? (
              <span className="text-sm font-semibold text-foreground">
                {item.value}
              </span>
            ) : null}
            {item.tag ? (
              <span
                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${toneToClass(item.tag.tone)}`}
              >
                {item.tag.label}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
