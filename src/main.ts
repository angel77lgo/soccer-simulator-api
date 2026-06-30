import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['*'],
    allowedHeaders: ['*'],
  });

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.PORT) || 3005;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
