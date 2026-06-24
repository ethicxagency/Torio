import { LoggerService, LogLevel } from "@nestjs/common";

export function getNestLogLevels(): LogLevel[] {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured === "debug") return ["error", "warn", "log", "debug", "verbose"];
  if (configured === "verbose") return ["error", "warn", "log", "debug", "verbose"];
  if (configured === "warn") return ["error", "warn"];
  if (configured === "error") return ["error"];
  if (process.env.NODE_ENV === "production") return ["error", "warn", "log"];
  return ["error", "warn", "log", "debug"];
}

export class ProductionLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write("info", message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string) {
    if (process.env.NODE_ENV !== "production") this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string) {
    if (process.env.NODE_ENV !== "production") this.write("verbose", message, context);
  }

  private write(level: string, message: unknown, context?: string, trace?: string) {
    const payload = {
      level,
      timestamp: new Date().toISOString(),
      context: context ?? "Application",
      message: typeof message === "string" ? message : JSON.stringify(message),
      ...(trace ? { trace } : {}),
    };

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(payload));
      return;
    }

    const prefix = `[${payload.timestamp}] ${level.toUpperCase()} [${payload.context}]`;
    if (level === "error") console.error(prefix, payload.message, trace ?? "");
    else if (level === "warn") console.warn(prefix, payload.message);
    else console.log(prefix, payload.message);
  }
}
