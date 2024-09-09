import { Injectable } from '@opensumi/di';

import { IHoverFixHandler, IProblemFixProviderRegistry } from '../../types';

@Injectable()
export class ProblemFixProviderRegistry implements IProblemFixProviderRegistry {
  private hoverFixProvider: IHoverFixHandler | undefined;

  registerHoverFixProvider(provider: IHoverFixHandler): void {
    this.hoverFixProvider = provider;
  }

  getHoverFixProvider(): IHoverFixHandler | undefined {
    return this.hoverFixProvider;
  }
}
