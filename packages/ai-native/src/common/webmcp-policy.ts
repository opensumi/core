export type WebMcpToolRiskLevel = 'read' | 'write' | 'destructive' | 'shell' | 'ui';
export type WebMcpProfile = 'minimal' | 'default' | 'interactive' | 'full';

export interface WebMcpToolPolicyMetadata {
  riskLevel?: WebMcpToolRiskLevel;
  exposedByDefault?: boolean;
  profiles?: WebMcpProfile[];
}

export function isValidWebMcpProfile(profile: unknown): profile is WebMcpProfile {
  return profile === 'minimal' || profile === 'default' || profile === 'interactive' || profile === 'full';
}

export function isWebMcpToolInProfile(tool: WebMcpToolPolicyMetadata, profile: WebMcpProfile): boolean {
  if (tool.profiles?.length) {
    return tool.profiles.includes(profile);
  }
  if (profile === 'full') {
    return true;
  }
  if (tool.riskLevel === 'shell') {
    return profile === 'interactive';
  }
  if (tool.riskLevel === 'destructive' || tool.riskLevel === 'write') {
    return false;
  }
  return profile === 'minimal' ? tool.riskLevel === 'read' : tool.riskLevel === 'read' || tool.riskLevel === 'ui';
}

export function isWebMcpToolExposedByDefault(tool: WebMcpToolPolicyMetadata): boolean {
  return tool.exposedByDefault !== false;
}

export function canExposeWebMcpTool(tool: WebMcpToolPolicyMetadata, profile: WebMcpProfile): boolean {
  return isWebMcpToolExposedByDefault(tool) && isWebMcpToolInProfile(tool, profile);
}
