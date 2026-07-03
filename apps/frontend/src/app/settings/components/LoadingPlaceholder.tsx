import Spinner from '~/core/ui/Spinner';

type LoadingPlaceholderProps = {
  message: string;
};

export function LoadingPlaceholder({ message }: LoadingPlaceholderProps) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
      <Spinner className="h-4 w-4" />
      {message}
    </div>
  );
}
