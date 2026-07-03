import Link from 'next/link';
import configuration from '~/configuration';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import I18nProvider from '~/i18n/I18nProvider';

export const metadata = {
  title: `Page not found - ${configuration.site.name}`,
};

const NotFoundPage = async () => {
  const i18n = await initializeServerI18n(await getLanguageCookie());

  return (
    <I18nProvider lang={i18n.language}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-primary">404</h1>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {i18n.t('common:pageNotFound')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {i18n.t('common:pageNotFoundSubHeading')}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {i18n.t('common:backToHomePage')}
          </Link>
        </div>
      </div>
    </I18nProvider>
  );
};

export default NotFoundPage;

