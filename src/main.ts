import {otelSDK} from 'src/tracing';
import {AppLogger, prepareContext} from '@kaiju-lib/node-common';
import {ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder, SwaggerCustomOptions, SwaggerModule} from '@nestjs/swagger';
import {createNamespace, getNamespace} from 'cls-hooked';
import 'es6-shim';
import 'reflect-metadata';
import {initializeTransactionalContext} from 'typeorm-transactional';
import {AppModule} from 'src/app.module';

// for context middleware
getNamespace(process.env.APP_NAMESPACE) || createNamespace(process.env.APP_NAMESPACE);

async function bootstrap() {
  if (process.env.ENABLE_APM == 'true') {
    await otelSDK.start();
  }
  // For @Transactional decorator
  console.log('Initializing Transactional..');
  initializeTransactionalContext();
  console.log('Completed Initializing Transactional..');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // buffer logs till logger is available
  });

  // remove x-powered-by header
  app.use(function (req, res, next) {
    res.header('x-powered-by', 'VM');
    next();
  });

  // Logger
  app.useLogger(app.get(AppLogger));

  // enable cors & OPTIONS
  app.enableCors();

  // set api base path from env
  app.setGlobalPrefix(process.env.API_BASE_PATH || '/api/v1');

  // add middleware for context
  app.use(prepareContext);

  // global validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      //skipUndefinedProperties: true,
      forbidUnknownValues: true,
    }),
  );

  // swagger documentation
  if (process?.env?.ENABLE_SWAGGER_UI == 'true' && process?.env?.NODE_ENV == 'development') {
    const customOptions: SwaggerCustomOptions = {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: process?.env?.APP_TITLE + ' API Docs',
    };

    const config = new DocumentBuilder()
      .setTitle(process?.env?.APP_TITLE)
      .setDescription('Business API description for ' + process?.env?.APP_TITLE)
      .setVersion(process?.env?.npm_package_version || '1.0')
      .addBasicAuth()
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger-ui', app, document, customOptions);
  }

  // listen to PORT from env
  // await app.listen(3000);
  await app.listen(parseInt(process.env.PORT, 10) || 3000);
}
bootstrap();
