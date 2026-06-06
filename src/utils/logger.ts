import { log } from '@livekit/agents';
import type { Logger } from 'pino';

export function createLogger(scope: string): Logger {
  let child: Logger | undefined;

  return new Proxy({} as Logger, {
    get(_target, prop) {
      child ??= log().child({ scope });
      const value = child[prop as keyof Logger];
      return typeof value === 'function' ? value.bind(child) : value;
    },
  });
}

export type { Logger };
