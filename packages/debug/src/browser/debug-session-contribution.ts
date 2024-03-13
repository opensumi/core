import { Autowired, Injectable } from '@opensumi/di';
import { ContributionProvider } from '@opensumi/ide-core-browser';

import { DebugSessionOptions } from '../common';

import { DebugSession } from './debug-session';

export const DebugSessionContribution = Symbol('DebugSessionContribution');

export interface DebugSessionContribution {
  /**
   * 调试类型，如node2
   */
  debugType: string;

  /**
   * 生成DebugSession的工厂函数.
   */
  debugSessionFactory(): DebugSessionFactory;
}

export const DebugSessionContributionRegistry = Symbol('DebugSessionContributionRegistry');

export interface DebugSessionContributionRegistry {
  get(debugType: string): DebugSessionContribution | undefined;
}

@Injectable()
export class DebugSessionContributionRegistryImpl implements DebugSessionContributionRegistry {
  protected readonly contribs = new Map<string, DebugSessionContribution>();

  @Autowired(DebugSessionContribution)
  protected readonly contributions: ContributionProvider<DebugSessionContribution>;

  constructor() {
    this.init();
  }

  protected init(): void {
    for (const contrib of this.contributions.getContributions()) {
      this.contribs.set(contrib.debugType, contrib);
    }
  }

  get(debugType: string): DebugSessionContribution | undefined {
    return this.contribs.get(debugType);
  }
}

export const DebugSessionFactory = Symbol('DebugSessionFactory');

/**
 * 生成DebugSession的工厂函数.
 */
export interface DebugSessionFactory {
  get(sessionId: string, options: DebugSessionOptions): DebugSession;
}
