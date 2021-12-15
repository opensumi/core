import { Autowired } from '@opensumi/di';
import {
  Domain,
  CommandService,
  CommandContribution,
  CommandRegistry,
  EDITOR_COMMANDS,
  URI,
} from '@opensumi/ide-core-browser';

import * as VSCodeBuiltinCommands from '@opensumi/ide-extension/lib/browser/vscode/builtin-commands';
import { UriComponents } from '@opensumi/ide-extension/lib/common/vscode/models';
import { TextDocumentShowOptions, ViewColumn } from '@opensumi/ide-extension/lib/common/vscode';
import {
  isLikelyVscodeRange,
  fromRange,
  viewColumnToResourceOpenOptions,
} from '@opensumi/ide-extension/lib/common/vscode/converter';
import { WorkbenchEditorService, IResourceOpenOptions } from '@opensumi/ide-editor';

@Domain(CommandContribution)
export class CommonCommandsContribution implements CommandContribution {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  registerCommands(commandRegistry: CommandRegistry) {
    // vscode.open
    commandRegistry.registerCommand(VSCodeBuiltinCommands.OPEN, {
      execute: (
        uriComponents: UriComponents,
        columnOrOptions?: ViewColumn | TextDocumentShowOptions,
        label?: string,
      ) => {
        const uri = URI.from(uriComponents);
        const options: IResourceOpenOptions = {};
        if (columnOrOptions) {
          if (typeof columnOrOptions === 'number') {
            options.groupIndex = columnOrOptions;
          } else {
            options.groupIndex = columnOrOptions.viewColumn;
            options.focus = options.preserveFocus = columnOrOptions.preserveFocus;
            // 这个range 可能是 vscode.range， 因为不会经过args转换
            if (columnOrOptions.selection && isLikelyVscodeRange(columnOrOptions.selection)) {
              columnOrOptions.selection = fromRange(columnOrOptions.selection);
            }
            options.range = columnOrOptions.selection;
            options.preview = columnOrOptions.preview;
          }
        }
        if (label) {
          options.label = label;
        }
        return this.workbenchEditorService.open(uri, options);
      },
    });

    // vscode.diff
    commandRegistry.registerCommand(VSCodeBuiltinCommands.DIFF, {
      execute: (left: UriComponents, right: UriComponents, title: string, options: any = {}) => {
        const openOptions: IResourceOpenOptions = {
          ...viewColumnToResourceOpenOptions(options.viewColumn),
          revealFirstDiff: true,
          ...options,
        };
        return this.commandService.executeCommand(
          EDITOR_COMMANDS.COMPARE.id,
          {
            original: URI.from(left),
            modified: URI.from(right),
            name: title,
          },
          openOptions,
        );
      },
    });
  }
}
