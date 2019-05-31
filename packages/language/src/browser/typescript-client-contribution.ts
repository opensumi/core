import { LanguageClientContribution } from './language-client-contribution';

export class TypescriptClientContribution extends LanguageClientContribution {
  id = 'typescript';
  name = 'TypeScript';
  clientOptions = {
    documentSelector: ['json', 'javascript', 'javascriptreact', 'typescriptreact', 'typescript'],
  };
}
