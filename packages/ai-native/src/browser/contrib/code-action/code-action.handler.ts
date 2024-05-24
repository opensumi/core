import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, IDisposable, PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, InlineChatFeatureRegistryToken, Schemes } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';

import { LanguageParserService } from '../../languages/service';
import { ICodeBlockInfo } from '../../languages/tree-sitter/language-facts/base';
import { InlineChatFeatureRegistry } from '../../widget/inline-chat/inline-chat.feature.registry';

@Injectable()
export class CodeActionHandler extends Disposable {
  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(LanguageParserService)
  private readonly languageParserService: LanguageParserService;

  private shouldAbortRequest(model: monaco.ITextModel) {
    if (model.uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
  }

  public registerCodeActionFeature(languageId: string, editor: IEditor): IDisposable {
    const disposable = new Disposable();

    let prefInlineChatActionEnabled = this.preferenceService.getValid(
      AINativeSettingSectionsId.INLINE_CHAT_CODE_ACTION_ENABLED,
      true,
    );

    if (!prefInlineChatActionEnabled) {
      return disposable;
    }

    const { monacoEditor } = editor;
    const { languageParserService, inlineChatFeatureRegistry, shouldAbortRequest } = this;

    let codeActionDispose: IDisposable | undefined;

    disposable.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.INLINE_CHAT_CODE_ACTION_ENABLED,
        ({ newValue }) => {
          prefInlineChatActionEnabled = newValue;
          if (newValue) {
            register();
          } else {
            if (codeActionDispose) {
              codeActionDispose.dispose();
              codeActionDispose = undefined;
            }
          }
        },
      ),
    );

    register();

    return disposable;

    function register() {
      if (codeActionDispose) {
        codeActionDispose.dispose();
        codeActionDispose = undefined;
      }

      codeActionDispose = languageFeaturesService.codeActionProvider.register(languageId, {
        provideCodeActions: async (model) => {
          if (shouldAbortRequest(model)) {
            return;
          }

          if (!prefInlineChatActionEnabled) {
            return;
          }

          const parser = languageParserService.createParser(languageId);
          if (!parser) {
            return;
          }
          const actions = inlineChatFeatureRegistry.getCodeActions();
          if (!actions || actions.length === 0) {
            return;
          }

          const cursorPosition = monacoEditor.getPosition();
          if (!cursorPosition) {
            return;
          }

          function constructCodeActions(info: ICodeBlockInfo) {
            return {
              actions: actions.map((v) => {
                const command = {} as monaco.Command;
                if (v.command) {
                  command.id = v.command.id;
                  command.arguments = [info.range];
                }

                let title = v.title;

                switch (info.infoCategory) {
                  case 'function': {
                    title = title + ` for Function: ${info.name}`;
                  }
                }

                return {
                  ...v,
                  title,
                  ranges: [info.range],
                  command,
                };
              }) as monaco.CodeAction[],
              dispose() {},
            };
          }

          const info = await parser.provideCodeBlockInfo(model, cursorPosition);
          if (info) {
            return constructCodeActions(info);
          }

          // check current line is empty
          const currentLineLength = model.getLineLength(cursorPosition.lineNumber);
          if (currentLineLength !== 0) {
            return;
          }

          // 获取视窗范围内的代码块
          const ranges = monacoEditor.getVisibleRanges();
          if (ranges.length === 0) {
            return;
          }

          // 查找从当前行至视窗最后一行的代码块中是否包含函数
          const newRange = new monaco.Range(cursorPosition.lineNumber, 0, ranges[0].endLineNumber + 1, 0);

          const rangeInfo = await parser.provideCodeBlockInfoInRange(model, newRange);
          if (rangeInfo) {
            return constructCodeActions(rangeInfo);
          }
        },
      });

      disposable.addDispose(codeActionDispose);
    }
  }
}
