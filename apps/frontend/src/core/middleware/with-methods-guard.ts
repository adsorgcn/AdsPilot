import { throwMethodNotAllowedException } from '~/core/http-exceptions';
import { NextApiRequest } from 'next';

/**
 * @description guard an API endpoint against unsupported methods
 * It can be used as a middleware for your writing your API handlers. For
 * example, if you API only supports GET requests
 *
 * @param request
 * @param methods
 */
function withMethodsGuard(request: NextApiRequest, methods: HttpMethod[]) {
  const method = request.method as HttpMethod;

  if (
    !methods
      .map((method) => method.toLowerCase())
      .includes(method.toLowerCase())
  ) {
    throwMethodNotAllowedException(methods, method);
  }
}

export default withMethodsGuard;
