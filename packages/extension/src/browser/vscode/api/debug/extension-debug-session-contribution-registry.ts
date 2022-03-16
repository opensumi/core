import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, ContributionProvider, Disposable, getDebugLogger } from '@opensumi/ide-core-browser';
import { DebugSessionContribution, DebugSessionContributionRegistry } from '@opensumi/ide-debug/lib/browser';

export interface ExtensionDebugSessionContributionRegistrator {
  /**
   * 注册DebugSession贡献点
   * @param contrib
   */
  registerDebugSessionContribution(contrib: DebugSessionContribution): IDisposable;

  /**
   * 注销DebugSession贡献点
   * @param debugType
   */
  unregisterDebugSessionContribution(debugType: string): void;
}

@Injectable()
export class ExtensionDebugSessionContributionRegistry
  implements DebugSessionContributionRegistry, ExtensionDebugSessionContributionRegistrator
{
  protected readonly contribs = new Map<string, DebugSessionContribution>();

  @Autowired(DebugSessionContribution)
  protected readonly contributions: ContributionProvider<DebugSessionContribution>;

  protected readonly debug = getDebugLogger();

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

  registerDebugSessionContribution(contrib: DebugSessionContribution): IDisposable {
    const { debugType } = contrib;

    if (this.contribs.has(debugType)) {
      this.debug.warn(`Debug session contribution already registered for ${debugType}`);
      return Disposable.NULL;
    }

    this.contribs.set(debugType, contrib);
    return Disposable.create(() => this.unregisterDebugSessionContribution(debugType));
  }

  unregisterDebugSessionContribution(debugType: string): void {
    this.contribs.delete(debugType);
  }
}
