import { inference, metrics, voice } from '@livekit/agents';

import { createLogger } from './logger.js';

const logger = createLogger('metrics');

export function attachSessionMetrics(session: voice.AgentSession): void {
  session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
    metrics.logMetrics(ev.metrics);
    logger.debug({ metrics: ev.metrics }, 'Session metrics collected');
  });
}

export function logUsageSummary(usage: unknown): void {
  logger.info({ usage }, 'Session usage summary');
}
