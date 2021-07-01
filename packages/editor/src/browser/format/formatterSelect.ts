
import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Injectable, Autowired } from '@ali/common-di';
import { QuickPickService, localize, PreferenceService, URI, PreferenceScope } from '@ali/ide-core-browser';
import { IEditorDocumentModelService } from '../doc-model/types';
import { ITextModel } from '@ali/ide-monaco/lib/browser/monaco-api/types';

type IProvider = monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider;

@Injectable()
export class FormattingSelector {

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(IEditorDocumentModelService)
  private modelService: IEditorDocumentModelService;

  async select(formatters: Array<monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider>, document: ITextModel) {
    const docRef = this.modelService.getModelReference(URI.from(document.uri.toJSON()));
    if (!docRef) {
      return;
    }
    const languageId = docRef.instance.languageId;
    docRef.dispose();
    const preferred = (this.preferenceService.get<{[key: string]: string}>('editor.preferredFormatter') || {})[languageId];

    const elements: {[key: string]: IProvider} = {};
    formatters.forEach((provider: IProvider) => {
      if (provider.extensionId) {
        elements[provider.extensionId] = provider;
      }
    });

    if (preferred) {
      if (elements[preferred]) {
        return elements[preferred];
      } else {
        // 喜好的插件已经不存在，进入选择
      }
    } else if (formatters.length < 2) {
        return formatters[0];
    }

    const selected = await this.quickPickService.show(
      Object.keys(elements).map((k) => ({ label: elements[k].displayName!, value: elements[k].extensionId })),
      { placeholder: localize('editor.format.chooseFormatter') },
    );
    if (selected) {
      const config = this.preferenceService.get<{[key: string]: string}>('editor.preferredFormatter') || {};
      this.preferenceService.set('editor.preferredFormatter', {...config, [languageId]: selected}, PreferenceScope.User);
      return elements[selected];
    } else {
      return undefined;
    }
  }

}
