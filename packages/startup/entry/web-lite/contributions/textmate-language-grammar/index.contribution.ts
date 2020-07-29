import { Autowired } from '@ali/common-di';
import { Disposable, Domain } from '@ali/ide-core-common';
import { FsProviderContribution } from '@ali/ide-core-browser';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';

const languages = [
  'html',
  'css',
  'javascript',
  'less',
  'markdown',
  'typescript',
];

@Domain(FsProviderContribution)
export class TextmateLanguageGrammarContribution extends Disposable implements FsProviderContribution {
  @Autowired(TextmateService)
  private readonly textMateService: TextmateService;

  // 由于使用了预加载 monaco, 导致 lang/grammar contribute 提前
  // 由于依赖了 kt-ext fs provider 注册，因此这里从 onMonacoLoad 改为 onStart
  onFileServiceReady() {
    // languages/grammars registration
    languages.forEach((language) => {
      import(/* webpackChunkName: kaitian-textmate-languages */ `@ali/kaitian-textmate-languages/lib/${language}`)
        .then((loadLanguage) => {
          loadLanguage(
            this.textMateService.registerLanguage.bind(this.textMateService),
            this.textMateService.registerGrammar.bind(this.textMateService),
          );
        })
        .catch((err) => {
          // tslint:disable:no-console
          console.log(err.message);
          console.warn(language, 'cannot load');
        });
    });
  }
}
