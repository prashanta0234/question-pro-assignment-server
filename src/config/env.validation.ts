import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .required(),

  PORT: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .default(3000),

  DB_HOST: Joi.string().required(),

  DB_PORT: Joi.number()
    .integer()
    .default(5432),

  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),

  REDIS_PORT: Joi.number()
    .integer()
    .default(6379),

  REDIS_PASSWORD: Joi.string()
    .optional()
    .allow(''),

  JWT_SECRET: Joi.string()
    .min(10)
    .required(),

  JWT_EXPIRES_IN: Joi.string().default('15m'),

  LOW_STOCK_THRESHOLD: Joi.number()
    .integer()
    .min(1)
    .default(10),

  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
