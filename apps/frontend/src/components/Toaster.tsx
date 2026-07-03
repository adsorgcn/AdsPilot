'use client';

import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

function Toaster({
  position = 'top-center',
  richColors = true,
  ...props
}: React.ComponentProps<typeof Sonner> = {}) {
  const { theme } = useTheme();

  return (
    <Sonner
      richColors={richColors}
      position={position}
      theme={theme as 'light' | 'dark'}
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.5)',
          color: 'hsl(var(--card-foreground))',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
        classNames: {
          toast: 'rounded-xl',
          title: 'font-medium',
          description: 'text-sm opacity-90',
          actionButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
          cancelButton: 'bg-muted text-muted-foreground hover:bg-muted/80',
        },
      }}
      {...props}
    />
  );
}

export default Toaster;
