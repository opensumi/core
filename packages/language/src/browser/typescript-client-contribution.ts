import { LanguageClientContribution } from './language-client-contribution';
import { Injectable } from '@ali/common-di';

@Injectable()
export class TypescriptClientContribution extends LanguageClientContribution {
  id = 'typescript';
  name = 'TypeScript';
  clientOptions = {
    documentSelector: ['json', 'javascript', 'javascriptreact', 'typescriptreact', 'typescript'],
  };
}
