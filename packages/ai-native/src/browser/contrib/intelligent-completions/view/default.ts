import { AI_CODE_EDITS_COMMANDS } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { CommandService } from '@opensumi/ide-core-common';
import {
  InlineCompletionContext,
  InlineCompletionTriggerKind,
  InlineCompletionsProvider,
  Position,
  Range,
} from '@opensumi/ide-monaco';
import {
  IObservable,
  asyncTransaction,
  constObservable,
  derived,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';
import { equalsIfDefined, itemEquals } from '@opensumi/monaco-editor-core/esm/vs/base/common/equals';
import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languageFeatureRegistry';
import { InlineCompletionsController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController';
import { InlineCompletionsModel } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel';
import {
  InlineCompletionsSource,
  UpToDateInlineCompletions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource';
import {
  InlineCompletionProviderResult,
  provideInlineCompletions,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/model/provideInlineCompletions';

import { CodeEditsResultValue, ICodeEdit, ICodeEditsResult } from '../index';


import { BaseCodeEditsView } from './base';

/**
 * copy from @opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/model/provideInlineCompletions
 */
class UpdateRequest {
  constructor(
    public readonly position: Position,
    public readonly context: InlineCompletionContext,
    public readonly versionId: number,
  ) {}

  public satisfies(other: UpdateRequest): boolean {
    return (
      this.position.equals(other.position) &&
      equalsIfDefined(this.context.selectedSuggestionInfo, other.context.selectedSuggestionInfo, itemEquals()) &&
      (other.context.triggerKind === InlineCompletionTriggerKind.Automatic ||
        this.context.triggerKind === InlineCompletionTriggerKind.Explicit) &&
      this.versionId === other.versionId
    );
  }

  public get isExplicitRequest() {
    return this.context.triggerKind === InlineCompletionTriggerKind.Explicit;
  }
}

export class DefaultCodeEditsView extends BaseCodeEditsView {
  private monacoCompletionsModel: IObservable<InlineCompletionsModel | undefined> = derived(this, (reader) => {
    const inlineCompletionsController = InlineCompletionsController.get(this.monacoEditor);
    if (!inlineCompletionsController) {
      return;
    }

    return inlineCompletionsController.model.read(reader);
  });

  private monacoCompletionsSource: IObservable<InlineCompletionsSource | undefined> = derived(this, (reader) => {
    const model = this.monacoCompletionsModel.read(reader);
    if (!model) {
      return;
    }

    const source = model['_source'] as InlineCompletionsSource;
    return source;
  });

  public render(completionModel: CodeEditsResultValue): void {
    const source = this.monacoCompletionsSource.get();
    if (!source) {
      return;
    }

    const position = this.editorObs.positions.get()?.[0];
    if (!position) {
      return;
    }

    const model = this.editorObs.model.get();
    if (!model) {
      return;
    }

    const originalContent = model.getValueInRange(completionModel.firstRange);
    // edits 的内容与原内容一样就不展示
    if (originalContent === completionModel.firstText) {
      return;
    }

    asyncTransaction(async (tx) => {
      const versionId = this.editorObs.versionId.get();
      const context: InlineCompletionContext = {
        triggerKind: InlineCompletionTriggerKind.Automatic,
        selectedSuggestionInfo: undefined,
        includeInlineCompletions: false,
        includeInlineEdits: true,
      };

      const request = new UpdateRequest(position, context, versionId!);
      const inlineEdits: InlineCompletionProviderResult = await provideInlineCompletions(
        {
          all: () => [
            {
              provideInlineCompletions: () => {},
              provideInlineEditsForRange(model, range, context, token) {
                return completionModel;
              },
              freeInlineCompletions: () => [],
              handleRejection: (completions, item) => {
                const commandService: CommandService = this.injector.get(CommandService);
                commandService.executeCommand(AI_CODE_EDITS_COMMANDS.DISCARD.id);
              },
            } as InlineCompletionsProvider<ICodeEditsResult<ICodeEdit>>,
          ],
        } as unknown as LanguageFeatureRegistry<InlineCompletionsProvider>,
        Range.lift(completionModel.firstRange),
        model,
        context,
      );

      const completions = new UpToDateInlineCompletions(
        inlineEdits,
        request,
        model,
        this.editorObs.versionId,
        constObservable(4000),
      );

      source.inlineCompletions.set(completions, tx);
      source.loading.set(false, tx);
    });
  }

  public accept(): void {
    const model = this.monacoCompletionsModel.get();
    model?.accept();
  }

  public discard(): void {
    const model = this.monacoCompletionsModel.get();
    transaction((tx) => {
      model?.stop('explicitCancel', tx);
    });
  }

  public hide(): void {
    this.monacoCompletionsSource.get()?.inlineCompletions?.set(undefined, undefined);
  }
}
