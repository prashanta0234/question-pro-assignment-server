import { Params } from 'nestjs-pino';


export function buildLoggerConfig(): Params {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    pinoHttp: {
      level: isDev ? 'debug' : 'info',

      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              levelFirst: false,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.confirmPassword',
          'req.body.currentPassword',
        ],
        censor: '[REDACTED]',
      },

      autoLogging: true,
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} → ${res.statusCode}`,

      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} → ${res.statusCode} | ${err.message}`,

      genReqId: (req) =>
        (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),

      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            userAgent: req.headers['user-agent'],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    },
  };
}
