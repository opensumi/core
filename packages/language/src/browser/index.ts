import { Provider, Injectable } from '@ali/common-di';
import { SlotMap, createContributionProvider } from '@ali/ide-core-browser';
import { LanguageFrontendContribution } from './language-frontend-contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { LanguageContribution, LanguageContributionProvider } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';

@Injectable()
export class LanguageModule extends BrowserModule {
  constructor() {
    super();
    createContributionProvider(this.injector, LanguageContribution, LanguageContributionProvider);
  }

  providers: Provider[] = [
    LanguageFrontendContribution,
    TypescriptClientContribution,
  ];
  slotMap: SlotMap = new Map();

  // TODO 我想声明的是一个抽象类……command的机制不完善
  // @ts-ignore
  // contributionsCls: [TypescriptClientContribution]

}
