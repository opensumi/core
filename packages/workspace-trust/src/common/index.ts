/**
 * Workspace trust state enum
 */
export enum WorkspaceTrustState {
  /** User has not yet decided */
  Undecided = 'undecided',
  /** User trusts this workspace - all extensions loaded */
  Trusted = 'trusted',
  /** User chose restricted mode - only allowed extensions loaded */
  Restricted = 'restricted',
}

/**
 * Storage key prefix for workspace trust state
 */
export const WORKSPACE_TRUST_STORAGE_KEY = 'workspace_trust_state';

/**
 * Base allowed extension IDs in restricted mode (can be extended via AllowedExtensionsContribution)
 */
export const DEFAULT_ALLOWED_EXTENSION_IDS = ['vscode.theme-defaults', 'vscode.typescript-language-features'];

/**
 * Service token for WorkspaceTrustService
 */
export const WorkspaceTrustServiceToken = Symbol('WorkspaceTrustService');

/**
 * Contribution token for allowed extensions registration
 */
export const AllowedExtensionsContribution = Symbol('AllowedExtensionsContribution');

export interface IAllowedExtensionsContribution {
  /**
   * Return additional extension IDs allowed in restricted mode
   */
  getAllowedExtensionIds(): string[];
}
