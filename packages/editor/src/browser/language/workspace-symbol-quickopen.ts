import { Injectable, Autowired } from '@ali/common-di';
import { QuickOpenHandler, QuickOpenModel, CancellationTokenSource, QuickOpenItem, CancellationToken, URI, QuickOpenMode, getSymbolIcon } from '@ali/ide-core-browser';
import { WorkspaceSymbolProvider, ILanguageService, WorkspaceSymbolParams, WorkbenchEditorService } from '../../common';
import type { SymbolInformation, Range } from 'vscode-languageserver-types';
import { ILogger, localize } from '@ali/ide-core-common';
import { IWorkspaceService } from '@ali/ide-workspace';
import * as flattenDeep from 'lodash.flattendeep';

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

  prefix = '#';

  get description() {
    return localize('editor.workspaceSymbol.description');
  }

  private cancellationSource = new CancellationTokenSource();

  getModel(): QuickOpenModel {
    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
        if (lookFor === '') {
          acceptor([new QuickOpenItem({
            label: localize('editor.workspaceSymbol.search'),
            run: () => false,
          })]);
          return;
        }

        if (this.languageService.workspaceSymbolProviders.length === 0) {
          acceptor([new QuickOpenItem({
            label: localize('editor.workspaceSymbol.notfound'),
            run: () => false,
          })]);
          return;
        }

        const items: QuickOpenItem[] = [];
        // 先传一个空数组占位
        acceptor(items);
        this.cancellationSource.cancel();
        const newCancellationSource = new CancellationTokenSource();
        this.cancellationSource = newCancellationSource;

        const param: WorkspaceSymbolParams = {
          query: lookFor,
        };
        Promise.all(this.languageService.workspaceSymbolProviders.map(async (provider) => {
          const symbols = await provider.provideWorkspaceSymbols(param, newCancellationSource.token);
          if (symbols && symbols.length && !newCancellationSource.token.isCancellationRequested) {
            const quickOpenItems = await Promise.all(symbols.map(async (symbol) => {
              const relativePath = await this.workspaceService.asRelativePath(symbol.location.uri) || '';
              return new SymbolInformationQuickOpenItem(symbol, provider, this.workbenchEditorService, newCancellationSource.token, relativePath);
            }));
            items.push(...quickOpenItems);
            acceptor(items);
          }
          return symbols;
        })).then((symbolsArr) => {
          const symbols = flattenDeep(symbolsArr);
          if (symbols.length === 0) {
            acceptor([new QuickOpenItem({
              label: localize('editor.workspaceSymbol.notfound'),
              run: () => false,
            })]);
          }
        }).catch((e) => {
          this.logger.log(e);
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
    };
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
}
