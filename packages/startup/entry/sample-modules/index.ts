import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { AINativeContribution } from './ai-native/ai-native.contribution';
import { DebugConfigurationContribution } from './debug-configuration.contribution';
import { EditorEmptyComponentContribution } from './editor-empty-component.contribution';
import { MenuBarContribution } from './menu-bar/menu-bar.contribution';
import { StatusBarContribution } from './status-bar.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
    EditorEmptyComponentContribution,
    StatusBarContribution,
    AINativeContribution,
    DebugConfigurationContribution,
  ];
}
