import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';

import getI18nSettings from './i18n.settings';

async function initializeServerI18n(lang?: Maybe<string>) {
  const i18nInstance = createInstance();
  const settings = getI18nSettings(lang);

  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(async (language, namespace, callback) => {
        try {
          // never extract the path to a variable, won't work
          const data = await import(
            `../../public/locales/${language}/${namespace}.json`
          );

          return callback(null, data.default);
        } catch (error) {
          console.log(
            `Error loading i18n file: ~/locales/${language}/${namespace}.json: ${error}`,
          );

          return {};
        }
      }),
    )
    .init(settings);

  return i18nInstance;
}

export default initializeServerI18n;
