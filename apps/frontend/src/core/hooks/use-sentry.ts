import { useEffect } from 'react';
import initializeBrowserSentry from '~/core/sentry/initialize-browser-sentry';

/**
 * @description Hook to initialize Sentry when a component mounts.
 */
function useSentry() {
  useEffect(() => {
    void initializeBrowserSentry();
  }, []);
}

export default useSentry;
