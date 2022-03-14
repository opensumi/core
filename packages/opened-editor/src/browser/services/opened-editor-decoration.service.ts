import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  Uri,
  FileDecorationsProvider,
  IFileDecoration,
  Emitter,
  DisposableCollection,
} from '@opensumi/ide-core-browser';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { IThemeService } from '@opensumi/ide-theme';

@Injectable()
export class OpenedEditorDecorationService implements FileDecorationsProvider {
  @Autowired(IDecorationsService)
  private readonly decorationsService: IDecorationsService;

  @Autowired(IThemeService)
  public readonly themeService: IThemeService;

  private disposeCollection: DisposableCollection = new DisposableCollection();

  private readonly onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor() {
    this.disposeCollection.pushAll([
      this.decorationsService.onDidChangeDecorations(() => {
        this.onDidChangeEmitter.fire();
      }),
      this.themeService.onThemeChange(() => {
        this.onDidChangeEmitter.fire();
      }),
    ]);
  }

  get onDidChange() {
    return this.onDidChangeEmitter.event;
  }

  getDecoration(uri, hasChildren = false) {
    // 转换URI为vscode.uri
    if (uri instanceof URI) {
      uri = Uri.parse(uri.toString());
    }
    const decoration = this.decorationsService.getDecoration(uri, hasChildren);
    if (decoration) {
      return {
        ...decoration,
        // 通过ThemeService获取颜色值
        color: this.themeService.getColor({ id: decoration.color as string }),
      } as IFileDecoration;
    }
    return {
      color: '',
      tooltip: '',
      badge: '',
    } as IFileDecoration;
  }

  dispose() {
    this.disposeCollection.dispose();
  }
}
