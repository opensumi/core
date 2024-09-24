import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { LanguageParserService } from '../../languages/service';
import { ICodeBlockInfo } from '../../languages/tree-sitter/language-facts/base';
import { BaseAIMonacoContribHandler } from '../base';

import { CodeActionService } from './code-action.service';

@Injectable()
export class CodeActionSingleHandler extends BaseAIMonacoContribHandler {
  @Autowired(CodeActionService)
  private readonly codeActionService: CodeActionService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(LanguageParserService)
  private readonly languageParserService: LanguageParserService;

  private inlineChatActionEnabled: boolean;

  constructor() {
    super();

    this.inlineChatActionEnabled = this.preferenceService.getValid(
      AINativeSettingSectionsId.InlineChatCodeActionEnabled,
      true,
    );

    this.addDispose(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineChatCodeActionEnabled,
        ({ newValue }) => {
          this.inlineChatActionEnabled = newValue;
          if (newValue) {
            this.load();
          } else {
            this.unload();
          }
        },
      ),
    );
  }

  doContribute() {
    return monacoApi.languages.registerCodeActionProvider('*', {
      provideCodeActions: async (model, range) => {
        if (!this.inlineChatActionEnabled) {
          return;
        }

        const content = model.getLineContent(range.startLineNumber);
        if (content?.trim() === empty) {
          return;
        }

        if (!this.shouldHandle(model.uri)) {
          return;
        }

        const { languageParserService, codeActionService } = this;
        const languageId = model.getLanguageId();
        const parser = languageParserService.createParser(languageId);
        if (!parser) {
          return;
        }
        const actions = codeActionService.getCodeActions();
        if (!actions || actions.length === 0) {
          return;
        }

        const startPosition = range.getStartPosition();
        if (!startPosition) {
          return;
        }

        function constructCodeActions(info: ICodeBlockInfo) {
          return {
            actions: actions.map((v) => {
              const command = {} as monaco.Command;
              if (v.command) {
                command.id = v.command.id;
                command.arguments = [info.range, ...v.command.arguments!];
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

        const info = await parser.provideCodeBlockInfo(model, startPosition);
        if (info) {
          return constructCodeActions(info);
        }

        // check current line is empty
        const currentLineLength = model.getLineLength(startPosition.lineNumber);
        if (currentLineLength !== 0) {
          return;
        }

        if (this.monacoEditor) {
          // 获取视窗范围内的代码块
          const ranges = this.monacoEditor.getVisibleRanges();
          if (ranges.length === 0) {
            return;
          }

          // 查找从当前行至视窗最后一行的代码块中是否包含函数
          const newRange = new monaco.Range(startPosition.lineNumber, 0, ranges[0].endLineNumber + 1, 0);

          const rangeInfo = await parser.provideCodeBlockInfoInRange(model, newRange);
          if (rangeInfo) {
            return constructCodeActions(rangeInfo);
          }
        }
      },
    });
  }
}
