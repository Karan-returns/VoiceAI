import type { voice } from '@livekit/agents';

import type { NovaTelAgent } from '../../agents/NovaTelAgent.js';
import { MidCallCorrectionMonitor } from './monitor.js';

export interface AttachMidCallCorrectionOptions {
  callId?: string;
}

export function attachMidCallCorrection(
  session: voice.AgentSession,
  agent: NovaTelAgent,
  options: AttachMidCallCorrectionOptions = {},
): MidCallCorrectionMonitor {
  const monitor = new MidCallCorrectionMonitor(
    options.callId !== undefined ? { callId: options.callId } : {},
  );
  monitor.attach(session);
  agent.setCorrectionMonitor(monitor);
  return monitor;
}

export { MidCallCorrectionMonitor } from './monitor.js';
export type { CorrectionSignal, InjectedCorrection, SentimentLevel } from './types.js';
