import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Grocery Booking API')
    .setDescription(
      `RESTful API for a grocery booking system built with NestJS.\n\n` +
        `## Roles\n` +
        `- **ADMIN** — full CRUD on grocery items, inventory management\n` +
        `- **USER** — browse available items, place and view own orders\n\n` +
        `## Authentication\n` +
        `All protected routes require a \`Bearer <JWT>\` token in the **Authorization** header.\n` +
        `1. Call \`POST /api/v1/auth/register\` or \`POST /api/v1/auth/login\`\n` +
        `2. Copy the \`accessToken\` from the response\n` +
        `3. Click the **Authorize** button and paste the token\n\n` +
        `## Overselling Protection\n` +
        `Orders are protected by a 3-layer mechanism: Redis atomic decrement → PostgreSQL \`SELECT FOR UPDATE\` → \`CHECK (stock >= 0)\` constraint.\n\n` +
        `## Idempotency\n` +
        `Include a unique \`Idempotency-Key: <uuid-v4>\` header on \`POST /orders\` to prevent duplicate orders on network retry.`,
    )
    .setVersion('1.0.0')
    .setContact('Grocery Booking', '', '')
    .setLicense('MIT', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token (without "Bearer " prefix)',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Register and login — public endpoints')
    .addTag('Groceries', 'Browse available grocery items — requires USER role')
    .addTag('Orders', 'Place and view orders — requires USER role')
    .addTag('Admin • Groceries', 'Full grocery CRUD and inventory management — requires ADMIN role')
    .addServer(`http://localhost:${process.env.PORT ?? 5000}`, 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, 
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: false,
    },
    customSiteTitle: 'Grocery Booking — API Docs',
    customfavIcon: '',
  });
}
