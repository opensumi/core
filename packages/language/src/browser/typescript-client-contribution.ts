import { LanguageClientContribution } from './language-client-contribution';
import { Injectable } from '@ali/common-di';
import { TYPESCRIPT_LANGUAGE_ID, TYPESCRIPT_LANGUAGE_NAME } from '../common';
import { LanguageContribution } from './language-client-contribution';
import { URI } from '@ali/ide-core-common';
import { Domain } from '@ali/ide-core-browser';

@Injectable()
@Domain(LanguageContribution)
export class TypescriptClientContribution extends LanguageClientContribution {
  id = TYPESCRIPT_LANGUAGE_ID;
  name = TYPESCRIPT_LANGUAGE_NAME;
  clientOptions = {
    documentSelector: ['json', 'javascript', 'javascriptreact', 'typescriptreact', 'typescript'],
  };

  matchLanguage(uri: URI) {
    if (/\.js|\.ts/.test(uri.toString())) {
      return true;
    }
    return false;
  }
}
