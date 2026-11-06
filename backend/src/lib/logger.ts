/* Minimal strukturalangan logger (JSON productionda, o'qiladigan formatda developmentda). */
type Level = 'debug' | 'info' | 'warn' | 'error';
const isProd = process.env.NODE_ENV === 'production';
const silent = process.env.NODE_ENV === 'test' && !process.env.LOG_TESTS;

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (silent && level !== 'error') return;
  if (isProd) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta }));
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${level}] ${msg}`, meta && Object.keys(meta).length ? meta : '');
  }
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};
