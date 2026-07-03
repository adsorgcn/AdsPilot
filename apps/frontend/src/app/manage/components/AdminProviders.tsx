'use client';

import I18nProvider from '~/i18n/I18nProvider';
import CsrfTokenContext from '~/lib/contexts/csrf';
import Toaster from '~/components/Toaster';

function AdminProviders(
  props: React.PropsWithChildren<{
    csrfToken: string | null;
    language: string | undefined;
  }>,
) {
  return (
    <I18nProvider lang={props.language}>
      <CsrfTokenContext.Provider value={props.csrfToken}>
        <Toaster richColors={false} />

        {props.children}
      </CsrfTokenContext.Provider>
    </I18nProvider>
  );
}

export default AdminProviders;
