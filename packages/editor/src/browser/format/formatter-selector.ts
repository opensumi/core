import { Autowired, Injectable } from '@opensumi/di';
import {
  PreferenceScope,
  PreferenceService,
  QuickPickItem,
  QuickPickService,
  URI,
  formatLocalize,
  localize,
} from '@opensumi/ide-core-browser';
import { DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider } from '@opensumi/ide-monaco';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IMessageService } from '@opensumi/ide-overlay';
import {
  FormattingKind,
  FormattingMode,
  IFormattingEditProviderSelector,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';

import { IEditorDocumentModelService } from '../doc-model/types';

type IFormattingEditProvider = DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider;

interface IFormattingSelector {
  selectFormatter: IFormattingEditProviderSelector;
}

const preferedFormatter = 'editor.preferredFormatter';

@Injectable()
export class FormattingSelector implements IFormattingSelector {
  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(IEditorDocumentModelService)
  private modelService: IEditorDocumentModelService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  async selectFormatter<T extends IFormattingEditProvider>(
    formatters: T[],
    document: ITextModel,
    mode: FormattingMode,
    _kind: FormattingKind,
  ): Promise<T | undefined> {
    const docDesc = this.modelService.getModelDescription(URI.from(document.uri.toJSON()));
    if (!docDesc) {
      return;
    }
    const languageId = docDesc.languageId;
    const preferred = this.getPreferedFormatter(languageId);

    const elements: { [key: string]: T } = {};
    formatters.forEach((provider: T) => {
      if (provider.extensionId) {
        elements[provider.extensionId as any] = provider;
      }
    });

    if (preferred) {
      if (elements[preferred]) {
        return elements[preferred];
      } else {
        this.messageService.error(formatLocalize('editor.format.preferredFormatterNotFound', preferred, languageId));
      }
    }

    if (formatters.length === 1) {
      return formatters[0];
    }

    if (mode === FormattingMode.Explicit) {
      const { selected, value } = await this.doPick(elements);

      if (value) {
        this.savePreferredFormatter(languageId, selected!);
        return elements[selected!];
      }
    } else {
      return undefined;
    }
  }

  protected async doPick<T extends IFormattingEditProvider>(elements: { [key: string]: T }) {
    const showItems = Object.keys(elements).map((k) => ({
      label: elements[k].displayName!,
      value: elements[k].extensionId as unknown as string,
    })) as QuickPickItem<string>[];

    const selected = await this.quickPickService.show(showItems, {
      placeholder: localize('editor.format.chooseFormatter'),
    });

    if (selected) {
      return {
        selected,
        value: elements[selected],
      };
    }

    return {};
  }

  protected getPreferedFormatter(languageId: string): string | undefined {
    const config = this.preferenceService.get<{ [key: string]: string }>(preferedFormatter) || {};
    return config[languageId];
  }

  protected async savePreferredFormatter(languageId: string, formatterId: string) {
    const config = this.preferenceService.get<{ [key: string]: string }>(preferedFormatter) || {};
    this.preferenceService.set(preferedFormatter, { ...config, [languageId]: formatterId }, PreferenceScope.User);
  }

  async pickFormatter<T extends IFormattingEditProvider>(
    formatters: T[],
    document: ITextModel,
  ): Promise<T | undefined> {
    const docDesc = this.modelService.getModelDescription(URI.from(document.uri.toJSON()));
    if (!docDesc) {
      return;
    }
    const languageId = docDesc.languageId;

    const elements: { [key: string]: T } = {};
    formatters.forEach((provider: T) => {
      if (provider.extensionId) {
        elements[provider.extensionId as unknown as string] = provider;
      }
    });
    const { selected, value } = await this.doPick(elements);
    if (value) {
      this.savePreferredFormatter(languageId, selected!);
      return value;
    }
  }
}
