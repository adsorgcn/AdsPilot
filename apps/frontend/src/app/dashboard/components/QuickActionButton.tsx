import HoverCard from '~/components/ui/hover-card';

interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  testId?: string;
}

export default function QuickActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled = false,
  variant = 'default',
  testId,
}: QuickActionButtonProps) {
  return (
    <HoverCard
      disabled={disabled}
      className={`p-4 ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : variant === 'primary'
          ? 'border-primary bg-primary/5'
          : ''
      }`}
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${
          variant === 'primary' ? 'bg-primary/10' : 'bg-muted'
        }`}>
          <Icon className={`h-5 w-5 ${
            variant === 'primary' ? 'text-primary' : 'text-muted-foreground'
          }`} />
        </div>

        <div className="flex-1">
          <p className={`font-medium ${
            variant === 'primary' ? 'text-primary' : ''
          }`}>
            {label}
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </HoverCard>
  );
}
