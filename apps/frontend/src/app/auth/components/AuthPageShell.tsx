import Logo from '~/core/ui/Logo';
import I18nProvider from '~/i18n/I18nProvider';
import { FullWidthPageLayout } from '~/core/ui/PageLayout';

function AuthPageShell({
  children,
  language,
}: React.PropsWithChildren<{
  language?: string;
}>) {
  return (
    <FullWidthPageLayout
      className="flex min-h-screen flex-col items-center justify-center space-y-4 md:space-y-6"
    >
      <Logo className="w-40 sm:w-56" />

      <div
        className="flex w-full max-w-sm flex-col items-center space-y-4 rounded-2xl border border-border/30 bg-background/70 px-5 py-6 backdrop-blur-lg shadow-[0_30px_120px_-60px_rgba(15,23,42,0.55)] md:max-w-md md:px-8 md:py-8"
      >
        <I18nProvider lang={language}>{children}</I18nProvider>
      </div>
    </FullWidthPageLayout>
  );
}

export default AuthPageShell;
