import { Autowired } from '@ali/common-di';
import { Disposable, Domain } from '@ali/ide-core-common';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';
import { ClientAppContribution } from '@ali/ide-core-browser';
import type { loadLanguageAndGrammar } from '@ali/kaitian-textmate-languages';

const languages = [
  'html',
  'css',
  'javascript',
  'less',
  'markdown',
  'typescript',
];

@Domain(ClientAppContribution)
export class TextmateLanguageGrammarContribution extends Disposable implements ClientAppContribution {
  @Autowired(TextmateService)
  private readonly textMateService: TextmateService;

  // 由于使用了预加载 monaco, 导致 lang/grammar contribute 提前
  // 由于依赖了 kt-ext fs provider 注册，因此这里从 onMonacoLoad 改为 onStart
  async initialize() {
    // languages/grammars registration
    for (const language of languages) {
      const mod = require(`@ali/kaitian-textmate-languages/lib/${language}`);
      const loadLanguage: loadLanguageAndGrammar =
        'default' in mod ? mod.default : mod;
      const registrationPromise = loadLanguage(
        this.textMateService.registerLanguage.bind(this.textMateService),
        this.textMateService.registerGrammar.bind(this.textMateService),
      );
      // FIXME: 后续考虑改成 queue 方式注册
      await Promise.all(registrationPromise);
    }
  }
}
