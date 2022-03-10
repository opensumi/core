import type { SymbolInformation, Range } from 'vscode-languageserver-types';

import { Injectable, Autowired } from '@opensumi/di';
import {
  QuickOpenHandler,
  QuickOpenModel,
  CancellationTokenSource,
  QuickOpenItem,
  CancellationToken,
  URI,
  QuickOpenMode,
  getSymbolIcon,
  getIcon,
} from '@opensumi/ide-core-browser';
import { ILogger, localize, IReporterService, REPORT_NAME } from '@opensumi/ide-core-common';
import { QuickOpenBaseAction, QuickOpenActionProvider } from '@opensumi/ide-quick-open';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { SymbolKind as SymbolKindEnum } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import {
  WorkspaceSymbolProvider,
  ILanguageService,
  WorkspaceSymbolParams,
  WorkbenchEditorService,
  EditorGroupSplitAction,
} from '../../common';

@Injectable()
class WorkspaceSymbolOpenSideAction extends QuickOpenBaseAction {
  constructor() {
    super({
      id: 'workspace-symbol:splitToRight',
      tooltip: localize('quickOpen.openSide'),
      class: getIcon('embed'),
    });
  }

  async run(item: SymbolInformationQuickOpenItem): Promise<void> {
    await item.openSide();
  }
}

@Injectable()
class WorkspaceSymbolActionProvider implements QuickOpenActionProvider {
  @Autowired()
  workspaceSymbolOpenSideActionOpen: WorkspaceSymbolOpenSideAction;

  hasActions(): boolean {
    return true;
  }

  getActions() {
    return [this.workspaceSymbolOpenSideActionOpen];
  }
}

@Injectable()
export class WorkspaceSymbolQuickOpenHandler implements QuickOpenHandler {
  @Autowired(ILanguageService)
  private readonly languageService: ILanguageService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  private readonly workspaceSymbolActionProvider: WorkspaceSymbolActionProvider;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  prefix = '#';

  get description() {
    return localize('editor.workspaceSymbol.description');
  }

  private cancellationSource = new CancellationTokenSource();

  getModel(): QuickOpenModel {
    return {
      onType: (
        lookFor: string,
        acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider | undefined) => void,
      ) => {
        if (lookFor === '') {
          acceptor([
            new QuickOpenItem({
              label: localize('editor.workspaceSymbol.search'),
              run: () => false,
            }),
          ]);
          return;
        }

        if (lookFor === '#') {
          return void acceptor([
            new QuickOpenItem({
              label: localize('editor.workspaceSymbolClass.search'),
              run: () => false,
            }),
          ]);
        }

        if (this.languageService.workspaceSymbolProviders.length === 0) {
          acceptor([
            new QuickOpenItem({
              label: localize('editor.workspaceSymbol.notfound'),
              run: () => false,
            }),
          ]);
          return;
        }

        const isSearchClass = lookFor[0] === '#';

        const items: QuickOpenItem[] = [];
        this.cancellationSource.cancel();
        const newCancellationSource = new CancellationTokenSource();
        this.cancellationSource = newCancellationSource;

        const param: WorkspaceSymbolParams = {
          query: isSearchClass ? lookFor.slice(1) : lookFor,
        };
        const timer = this.reporterService.time(REPORT_NAME.QUICK_OPEN_MEASURE);
        Promise.all(
          this.languageService.workspaceSymbolProviders.map(async (provider) => {
            let symbols = await provider.provideWorkspaceSymbols(param, newCancellationSource.token);
            if (isSearchClass) {
              symbols = symbols?.filter((symbol) => symbol.kind === SymbolKindEnum.Class);
            }
            if (symbols && symbols.length && !newCancellationSource.token.isCancellationRequested) {
              const quickOpenItems = await Promise.all(
                symbols.map(async (symbol) => {
                  const relativePath =
                    (await this.workspaceService.asRelativePath(new URI(symbol.location.uri).parent)) || '';
                  return new SymbolInformationQuickOpenItem(
                    symbol,
                    provider,
                    this.workbenchEditorService,
                    newCancellationSource.token,
                    relativePath,
                  );
                }),
              );
              items.push(...quickOpenItems);
              acceptor(items, this.workspaceSymbolActionProvider);
            }
            return symbols;
          }),
        )
          .catch((e) => {
            this.logger.log(e);
          })
          .finally(() => {
            if (!newCancellationSource.token.isCancellationRequested) {
              // 无数据清空历史数据
              if (!items.length) {
                acceptor([]);
              }
              timer.timeEnd(isSearchClass ? 'class' : 'symbol', {
                lookFor,
                stat: {
                  symbol: items.length,
                },
              });
            }
          });
      },
    };
  }

  getOptions() {
    return {
      fuzzyMatchLabel: {
        enableSeparateSubstringMatching: true,
      },
      showItemsWithoutHighlight: true,
      // 不搜索文件路径
      fuzzyMatchDescription: false,
      getPlaceholderItem: (lookFor: string, originLookFor: string) =>
        new QuickOpenItem({
          label: localize(
            originLookFor.startsWith('##') ? 'editor.workspaceSymbolClass.notfound' : 'editor.workspaceSymbol.notfound',
          ),
          run: () => false,
        }),
    };
  }

  onClose() {
    this.cancellationSource.cancel();
  }

  onToggle() {
    this.cancellationSource.cancel();
  }
}

export class SymbolInformationQuickOpenItem extends QuickOpenItem {
  constructor(
    protected readonly symbol: SymbolInformation,
    private readonly provider: WorkspaceSymbolProvider,
    private readonly workbenchEditorService: WorkbenchEditorService,
    private readonly token: CancellationToken,
    private relativePath: string,
  ) {
    super({});
  }

  getLabel(): string {
    return this.symbol.name;
  }

  getUri() {
    return new URI(this.symbol.location.uri);
  }

  getIconClass() {
    return getSymbolIcon(this.symbol.kind);
  }

  getDescription() {
    const containerName = this.symbol.containerName;
    return `${containerName ? `${containerName} · ` : ''}${decodeURIComponent(this.relativePath)}`;
  }

  private fromRange(range: Range) {
    if (!range) {
      return undefined;
    }
    const { start, end } = range;
    return {
      startLineNumber: start.line + 1,
      startColumn: start.character + 1,
      endLineNumber: end.line + 1,
      endColumn: end.character + 1,
    };
  }

  private open(uri: URI, range: Range) {
    this.workbenchEditorService.open(uri, {
      range: this.fromRange(range),
    });
  }

  run(mode: QuickOpenMode): boolean {
    const uri = this.getUri();
    if (mode === QuickOpenMode.OPEN) {
      this.provider.resolveWorkspaceSymbol(this.symbol, this.token).then((resolvedSymbol) => {
        if (resolvedSymbol) {
          this.open(uri, resolvedSymbol.location.range);
        } else {
          this.open(uri, this.symbol.location.range);
        }
      });
    }
    return true;
  }

  openSide() {
    const uri = this.getUri();
    return this.provider.resolveWorkspaceSymbol(this.symbol, this.token).then((resolvedSymbol) => {
      this.workbenchEditorService.open(uri, {
        preview: false,
        split: EditorGroupSplitAction.Right,
        range: this.fromRange(resolvedSymbol ? resolvedSymbol.location.range : this.symbol.location.range),
        focus: true,
      });
    });
  }
}
