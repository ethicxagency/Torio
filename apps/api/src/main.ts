import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { API_PREFIX } from "@mango/shared";
import { assertProductionEnv, getApiPort, getCorsOrigins } from "./common/config/app-env";
import { getNestLogLevels, ProductionLogger } from "./common/logger/production-logger";

async function bootstrap() {
  assertProductionEnv();

  const isProduction = process.env.NODE_ENV === "production";
  const app = await NestFactory.create(AppModule, {
    logger: isProduction ? new ProductionLogger() : getNestLogLevels(),
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.setGlobalPrefix(API_PREFIX.replace("/v1", ""));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Torio API")
      .setDescription("Torio – AI Messaging Platform for eCommerce")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = getApiPort();
  await app.listen(port, "0.0.0.0");

  const logger = new ProductionLogger();
  logger.log(`API listening on 0.0.0.0:${port}${API_PREFIX}`, "Bootstrap");
}

bootstrap();
