import { log } from '@livekit/agents';
import type { Logger } from 'pino';

/**
 * Lazy logger wrapper.
 *
 * LiveKit initializes logging when the worker starts, not at import time.
 * This delays `log().child(...)` until the first log call.
 *
 * Usage matches pino:
 *   logger.info({ room: "abc" }, "session started");
 */
class LazyLogger {
  private readonly scope: string;
  private childLogger: Logger | undefined;

  constructor(scope: string) {
    this.scope = scope;
  }

  private get logger(): Logger {
    if (this.childLogger === undefined) {
      this.childLogger = log().child({ scope: this.scope });
    }
    return this.childLogger;
  }

  debug(...args: unknown[]): void {
    this.logger.debug(...(args as Parameters<Logger['debug']>));
  }

  info(...args: unknown[]): void {
    this.logger.info(...(args as Parameters<Logger['info']>));
  }

  warn(...args: unknown[]): void {
    this.logger.warn(...(args as Parameters<Logger['warn']>));
  }

  error(...args: unknown[]): void {
    this.logger.error(...(args as Parameters<Logger['error']>));
  }
}

export function createLogger(scope: string): LazyLogger {
  return new LazyLogger(scope);
}

export type { Logger };
