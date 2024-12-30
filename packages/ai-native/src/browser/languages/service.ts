import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';

import { LanguageParser } from './parser';
import { SupportedTreeSitterLanguages, parserNameMap } from './tree-sitter/language-facts';

@Injectable()
export class LanguageParserService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private pool = new Map<SupportedTreeSitterLanguages, LanguageParser>();

  createParser(language: string) {
    const treeSitterLang = parserNameMap[language];
    if (treeSitterLang) {
      if (!this.pool.has(treeSitterLang)) {
        this.pool.set(treeSitterLang, this.injector.get(LanguageParser, [treeSitterLang]));
      }

      return this.pool.get(treeSitterLang);
    }
  }

  dispose() {
    this.pool.forEach((parser) => parser.dispose());
    this.pool.clear();
  }
}
