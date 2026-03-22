import { PreferenceService } from '@opensumi/ide-core-browser';
import { ACPAgentType, DEFAULT_AGENT_TYPE } from '@opensumi/ide-core-common';

/**
 * Get the default agent type from user preferences
 * @param preferenceService - PreferenceService to read user config
 * @returns The default agent type
 */
export function getDefaultAgentType(preferenceService: PreferenceService): ACPAgentType {
  return preferenceService.get<ACPAgentType>('ai.native.agent.defaultType', DEFAULT_AGENT_TYPE);
}
