import { LanguageServerContribution } from './language-server-contribution';
import { TypeScriptServerContribution } from './typescript-server-contribution';

export class LanguageServerProvider {
  contributions: LanguageServerContribution[] = [new TypeScriptServerContribution()];
}
