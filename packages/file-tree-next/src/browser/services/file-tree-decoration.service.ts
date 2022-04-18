import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  Uri,
  FileDecorationsProvider,
  IFileDecoration,
  Emitter,
  DisposableCollection,
} from '@opensumi/ide-core-browser';
import { IDecorationData, IDecorationsService } from '@opensumi/ide-decoration';
import { IThemeService } from '@opensumi/ide-theme';

@Injectable()
export class FileTreeDecorationService implements FileDecorationsProvider {
  @Autowired(IDecorationsService)
  private readonly decorationsService: IDecorationsService;

  @Autowired(IThemeService)
  public readonly themeService: IThemeService;

  private disposeCollection: DisposableCollection = new DisposableCollection();

  private readonly onDidChangeEmitter: Emitter<void> = new Emitter();

  private cacheDecorations = new Map<string, IDecorationData>();

  constructor() {
    this.disposeCollection.pushAll([
      this.decorationsService.onDidChangeDecorations((e) => {
        const effectResource = (e as any)._data?._iter?._value;
        if (effectResource) {
          const uri = new URI(effectResource);
          const decoration = this.getDecoration(uri);
          if (this.cacheDecorations.has(effectResource)) {
            if (this.cacheDecorations.get(effectResource)?.tooltip !== decoration?.tooltip) {
              // 当节点装饰发生变化时，更新节点
              this.onDidChangeEmitter.fire();
            }
          } else {
            // 首次获取到文件装饰时，更新节点
            this.cacheDecorations.set(effectResource, decoration);
            this.onDidChangeEmitter.fire();
          }
        }
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
