import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceScope, PreferenceService, QuickPickService, URI, localize } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { FormattingMode } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';

import { IEditorDocumentModelService } from '../doc-model/types';

type IProvider = monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider;

@Injectable()
export class FormattingSelector {
  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(IEditorDocumentModelService)
  private modelService: IEditorDocumentModelService;

  async select(
    formatters: Array<
      monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider
    >,
    document: ITextModel,
    mode: FormattingMode,
    forceSelect = false,
  ): Promise<
    monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider | undefined
  > {
    const docRef = this.modelService.getModelReference(URI.from(document.uri.toJSON()));
    if (!docRef) {
      return;
    }
    const languageId = docRef.instance.languageId;
    docRef.dispose();
    let preferred;
    if (!forceSelect) {
      preferred = (this.preferenceService.get<{ [key: string]: string }>('editor.preferredFormatter') || {})[
        languageId
      ];
    }

    const elements: { [key: string]: IProvider } = {};
    formatters.forEach((provider: IProvider) => {
      if (provider.extensionId) {
        elements[provider.extensionId as any] = provider;
      }
    });

    if (preferred && !forceSelect) {
      const idx = formatters.findIndex((provider: IProvider) => provider.extensionId === preferred);
      if (idx >= 0) {
        return formatters[idx];
      }
    } else if (formatters.length < 2 && !forceSelect) {
      return formatters[0];
    }

    if (mode === FormattingMode.Explicit) {
      const selected = await this.quickPickService.show(
        Object.keys(elements).map((k) => ({
          label: elements[k].displayName!,
          value: elements[k].extensionId,
        })),
        { placeholder: localize('editor.format.chooseFormatter') },
      );
      if (selected) {
        const config = this.preferenceService.get<{ [key: string]: string }>('editor.preferredFormatter') || {};
        this.preferenceService.set(
          'editor.preferredFormatter',
          { ...config, [languageId]: selected },
          PreferenceScope.User,
        );
        return elements[selected as any];
      }
    } else {
      return undefined;
    }
  }
}
