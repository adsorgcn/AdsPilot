import type { Logger } from 'pino';

let logger: Logger;

/**
 * @name getLogger
 */
function getLogger() {
  if (logger) {
    return logger;
  }

  const pino = require('pino');

  logger = pino({
    browser: {
      asObject: true,
    },
    level: 'debug',
    base: {
      env: process.env.NODE_ENV,
    },
  });

  return logger;
}

export default getLogger;
