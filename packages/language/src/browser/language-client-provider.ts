import { LanguageClientContribution } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';
import { Injectable } from '@ali/common-di';

@Injectable()
export class LanguageClientProvider {
  // TODO 需要
  contributions: LanguageClientContribution[] = [new TypescriptClientContribution()];
}
