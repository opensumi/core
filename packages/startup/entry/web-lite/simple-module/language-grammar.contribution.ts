import { Autowired } from '@ali/common-di';
import { Disposable, Domain, URI } from '@ali/ide-core-common';
import { FsProviderContribution } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';

import { tsLangBasicExtContributes } from '../ide-exts/ts';

@Domain(FsProviderContribution)
export class LanguageGrammarContribution extends Disposable implements FsProviderContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(TextmateService)
  private readonly textMateService: TextmateService;

  get workspaceUri() {
    return new URI(this.workspaceService.workspace!.uri);
  }

  get projectRootPath() {
    return this.workspaceUri.path;
  }

  // 由于使用了预加载 monaco, 导致 lang/grammar contribute 提前
  // 由于依赖了 kt-ext fs provider 注册，因此这里从 onMonacoLoad 改为 onStart
  onFileServiceReady() {
    // languages/grammars registration
    tsLangBasicExtContributes.pkgJSON.contributes.languages.forEach((language) => {
      this.textMateService.registerLanguage(language as any, URI.parse(tsLangBasicExtContributes.extPath));
    });

    tsLangBasicExtContributes.pkgJSON.contributes.grammars.forEach((grammar) => {
      this.textMateService.registerGrammar(grammar as any, URI.parse(tsLangBasicExtContributes.extPath));
    });
  }
}
