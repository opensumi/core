import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { KernelPanelContribution } from './kernel.panel.contribution';
export * from './kernel-panel-view';
export * from './kernel.panel.color.tokens';
export * from './kernel.panel.contribution';
export * from './kernel.panel.protocol';

@Injectable()
export class KernelPanelModule extends BrowserModule {
  providers: Provider[] = [KernelPanelContribution];
}
