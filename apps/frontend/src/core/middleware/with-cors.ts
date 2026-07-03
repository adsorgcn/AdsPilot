/**
 * @name withCors
 * @description Returns the headers to enable CORS for the API route
 *
 */
function withCors() {
  const headers = new Headers();

  headers.append('Access-Control-Allow-Origin', '*');

  headers.append(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, referer-path'
  );

  return headers;
}

export default withCors;
