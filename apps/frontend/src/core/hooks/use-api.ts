import { useCallback, useRef } from 'react';
import useCsrfTokenHeader from '~/core/hooks/use-csrf-token-header';

/**
 * @name useApiRequest
 * @description A hook to make API requests
 * 1. By default, it will use the `POST` method and will send the payload as
 * JSON
 * 2. Also, it will automatically add the CSRF token to the request headers
 */
function useApiRequest<Resp = unknown, Body = void>() {
  const headersRef = useRef<StringObject>({});
  const csrfTokenHeader = useCsrfTokenHeader();

  return useCallback(
    async (params: {
      path: string;
      body?: Body;
      method?: HttpMethod;
      headers?: StringObject;
    }) => {
      const payload = JSON.stringify(params.body);

      // initialize the headers if they are not defined
      if (!headersRef.current) {
        headersRef.current = params.headers ?? {};
      }

      // add the CSRF token to the request headers if it exists
      if (csrfTokenHeader['X-CSRF-Token']) {
        headersRef.current = {
          ...headersRef.current,
          ...csrfTokenHeader,
        };
      }

      // execute the fetch request
      return executeFetchRequest<Resp>(
        params.path,
        payload,
        params.method,
        headersRef.current
      );
    },
    [csrfTokenHeader]
  );
}

async function executeFetchRequest<Resp = unknown>(
  url: string,
  payload: string,
  method = 'POST',
  headers?: StringObject
) {
  const options: RequestInit = {
    method,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
  };

  const methodsSupportingBody: HttpMethod[] = ['POST', 'PUT'];
  const supportsBody = methodsSupportingBody.includes(method as HttpMethod);

  if (payload && supportsBody) {
    options.body = payload;
  }

  try {
    const response = await fetch(url, options);

    if (response.redirected) {
      return window.location.assign(response.url);
    }

    if (response.ok) {
      return (await response.json()) as Promise<Resp>;
    }

    return Promise.reject(await response.json());
  } catch (error) {
    return Promise.reject(error);
  }
}

export default useApiRequest;
