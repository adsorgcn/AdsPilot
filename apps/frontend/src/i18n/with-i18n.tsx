import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

type LayoutOrPageComponent<Params> = React.ComponentType<Params>;

export function withI18n<Params extends object>(
  Component: LayoutOrPageComponent<Params>,
) {
  return async function I18nServerComponentWrapper(params: Params) {
    const languageCookie = await getLanguageCookie();
    await initializeServerI18n(languageCookie);

    return <Component {...params} />;
  };
}
