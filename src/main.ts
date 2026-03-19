import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Nutrilly API')
    .setDescription(
      `## Nutrilly – Food & Nutrition Tracking API

Track meals, macronutrients, hydration, and daily streaks.

### Authentication
All protected endpoints require a **Bearer token** obtained from \`POST /auth/login\`, \`POST /auth/register\`, \`POST /auth/google\`, or \`POST /auth/apple\`.

Include the token in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### AI-Powered Meal Logging
- **\`POST /meals/from-photo\`** – Upload a photo of your food; AI identifies items and calculates macros automatically.
- **\`POST /meals/from-description\`** – Describe your meal in plain text; AI infers macros automatically.

### Key Concepts
- **Foods** are reusable catalog items with macro data per 100 g.
- **Meals** group one or more food items eaten at a specific time.
- **Daily goals** let users set calorie, macro, and hydration targets.
- **Streaks** track consecutive days where the user met ≥ 90% of their calorie goal.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    useGlobalPrefix: false,
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
