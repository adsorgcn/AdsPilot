'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { IconGlyph, listIconOptions } from '~/components/icons';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { MarketingPageLayout } from '~/core/ui/PageLayout';

const COLOR_SWATCHES: Array<{ key: string; className: string }> = [
  { key: 'brand600', className: 'bg-brand-600 text-white' },
  { key: 'success500', className: 'bg-success-500 text-white' },
  { key: 'warning500', className: 'bg-warning-500 text-white' },
  { key: 'error500', className: 'bg-error-500 text-white' },
  {
    key: 'surfaceDefault',
    className: 'bg-surface-default text-foreground border border-border',
  },
  {
    key: 'surfaceMuted',
    className: 'bg-surface-muted text-foreground border border-border',
  },
];

const TYPOGRAPHY_BLOCKS: Array<{ key: string; className: string }> = [
  { key: 'heading1', className: 'heading-1' },
  { key: 'heading2', className: 'heading-2' },
  { key: 'heading3', className: 'heading-3' },
  { key: 'body', className: 'text-base leading-relaxed' },
  { key: 'caption', className: 'text-sm text-muted-foreground' },
];

export default function StyleGuidePage() {
  const { t } = useTranslation('styleGuide');
  const { t: tNavigation } = useTranslation('navigation');

  const iconItems = useMemo(() => {
    return listIconOptions().map((icon) => ({
      name: icon.name,
      label: t(`icons.labels.${icon.name}`, {
        defaultValue: tNavigation(icon.name, { defaultValue: icon.label }),
      }),
    }));
  }, [t, tNavigation]);

  return (
    <MarketingPageLayout maxWidth="7xl" className="space-y-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t('header.badge')}
        </p>
        <h1 className="heading-1 text-foreground">{t('header.title')}</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {t('header.description')}
        </p>
      </header>

      <section aria-labelledby="section-colors" className="space-y-6">
        <SectionHeader
          id="section-colors"
          title={t('colors.title')}
          description={t('colors.description')}
        />

        <div className="layout-grid">
          {COLOR_SWATCHES.map((item) => {
            const label = t(`colors.items.${item.key}.label`);

            return (
              <ColorSwatch
                key={item.key}
                label={label}
                className={item.className}
                footnote={t('colors.footnote')}
                ariaLabel={t('colors.ariaLabel', { label })}
              />
            );
          })}
        </div>
      </section>

      <PageDivider />

      <section aria-labelledby="section-typography" className="space-y-6">
        <SectionHeader
          id="section-typography"
          title={t('typography.title')}
          description={t('typography.description')}
        />

        <div className="space-y-6">
          {TYPOGRAPHY_BLOCKS.map((block) => (
            <TypographyBlock
              key={block.key}
              title={t(`typography.blocks.${block.key}.title`)}
              className={block.className}
            >
              {t(`typography.blocks.${block.key}.content`)}
            </TypographyBlock>
          ))}
        </div>
      </section>

      <PageDivider />

      <section aria-labelledby="section-components" className="space-y-6">
        <SectionHeader
          id="section-components"
          title={t('components.title')}
          description={t('components.description')}
        />

        <div className="layout-grid">
          <div className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="heading-4">{t('components.buttons.title')}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button>{t('components.buttons.primary')}</Button>
              <Button variant="outline">{t('components.buttons.secondary')}</Button>
              <Button variant="ghost">{t('components.buttons.tertiary')}</Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="heading-4">{t('components.badges.title')}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Badge color="success">{t('components.badges.success')}</Badge>
              <Badge color="warn">{t('components.badges.warning')}</Badge>
              <Badge color="error">{t('components.badges.error')}</Badge>
              <Badge color="info">{t('components.badges.info')}</Badge>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="heading-4">{t('components.card.title')}</h3>
            <div className="space-y-4 rounded-lg border border-border bg-surface-default p-5 shadow-md shadow-brand-500/5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <IconGlyph name="automation" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {t('components.card.heading')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('components.card.body')}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700"
              >
                {t('components.card.cta')}
                <IconGlyph name="link" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PageDivider />

      <section aria-labelledby="section-icons" className="space-y-6">
        <SectionHeader
          id="section-icons"
          title={t('icons.title')}
          description={t('icons.description')}
        />

        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          role="list"
          aria-label={t('icons.ariaLabel')}
        >
          {iconItems.map((icon) => (
            <div
              key={icon.name}
              role="listitem"
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <IconGlyph name={icon.name} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{icon.label}</p>
                  <p className="text-xs text-muted-foreground">{icon.name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingPageLayout>
  );
}

function SectionHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <h2 id={id} className="heading-2 text-foreground">
        {title}
      </h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PageDivider() {
  return <hr className="border-border/70" aria-hidden />;
}

function ColorSwatch({
  label,
  className,
  footnote,
  ariaLabel,
}: {
  label: string;
  className: string;
  footnote: string;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-lg border border-border p-4 shadow-sm"
      aria-label={ariaLabel}
    >
      <div className={`h-16 w-full rounded-md ${className}`} />
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{footnote}</p>
    </div>
  );
}

function TypographyBlock({
  title,
  className,
  children,
}: React.PropsWithChildren<{ title: string; className: string }>) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className={className}>{children}</p>
    </div>
  );
}
