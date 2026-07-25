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
 * Service token for WorkspaceTrustService
 */
export const WorkspaceTrustServiceToken = Symbol('WorkspaceTrustService');
