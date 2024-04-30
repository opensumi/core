import { Autowired, Injectable } from '@opensumi/di';
import { DisposableStore, IDisposable, IEventBus, URI } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { IIconService, IThemeService } from '@opensumi/ide-theme';
import { ICSSStyleService } from '@opensumi/ide-theme/lib/common/style';

import { IContentDecorationRenderOptions, IDecorationRenderOptions, IThemeDecorationRenderOptions } from '../common';

import {
  EditorDecorationChangeEvent,
  EditorDecorationProviderRegistrationEvent,
  EditorDecorationTypeRemovedEvent,
  IBrowserTextEditorDecorationType,
  IDynamicModelDecorationProperty,
  IEditorDecorationCollectionService,
  IEditorDecorationProvider,
  IThemedCssStyle,
  IThemedCssStyleCollection,
} from './types';

@Injectable()
export class EditorDecorationCollectionService implements IEditorDecorationCollectionService {
  decorations: Map<string, IBrowserTextEditorDecorationType> = new Map();

  @Autowired(ICSSStyleService)
  private readonly cssManager: ICSSStyleService;

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  private tempId = 0;

  getNextTempId() {
    this.tempId++;
    return 'temp-decoration-' + this.tempId;
  }

  decorationProviders: Map<string, IEditorDecorationProvider> = new Map();

  createTextEditorDecorationType(options: IDecorationRenderOptions, key?: string): IBrowserTextEditorDecorationType {
    if (!key) {
      key = this.getNextTempId();
    }
    const property = this.resolveDecoration(key, options);
    const type = {
      key,
      property,
      dispose: () => {
        if (key && this.decorations.has(key)) {
          property.dispose();
          this.decorations.delete(key!);
          this.eventBus.fire(new EditorDecorationTypeRemovedEvent(key!));
        }
      },
    };
    this.decorations.set(key, type);
    return type;
  }

  getTextEditorDecorationType(key) {
    return this.decorations.get(key);
  }

  private resolveDecoration(key: string, options: IDecorationRenderOptions): IDynamicModelDecorationProperty {
    const theme = this.createThemeCSSStyleCollection(key, options);

    const dec = {
      default: theme.default,
      light: theme.light,
      dark: theme.dark,
      isWholeLine: options.isWholeLine || false,
      overviewRulerLane: options.overviewRulerLane,
      dispose: () => {
        theme.dispose();
      },
    };

    return dec;
  }

  private createThemeCSSStyleCollection(key: string, options: IDecorationRenderOptions): IThemedCssStyleCollection {
    const disposer = new DisposableStore();

    const defaultStyle = this.addedThemeDecorationToCSSStyleSheet(key, options);
    const result = {
      default: defaultStyle,
      light: null,
      dark: null,
      dispose: () => {
        disposer.dispose();
      },
    } as IThemedCssStyleCollection;

    if (options.light) {
      const lightStyle = this.addedThemeDecorationToCSSStyleSheet(key + '-light', options.light);
      result.light = lightStyle;
      disposer.add(lightStyle);
    }
    if (options.dark) {
      const darkStyle = this.addedThemeDecorationToCSSStyleSheet(key + '-dark', options.dark);
      result.dark = darkStyle;
      disposer.add(darkStyle);
    }

    return result;
  }

  private addedThemeDecorationToCSSStyleSheet(key: string, options: IDecorationRenderOptions): IThemedCssStyle {
    const className = key;
    const inlineClassName = key + '-inline';
    const disposer = new DisposableStore();
    let afterContentClassName: string | undefined;
    let beforeContentClassName: string | undefined;
    let glyphMarginClassName: string | undefined;

    const inlineBlockSelector = this.createInlineBlockCSSStyleIfNeeded();

    const styles = this.resolveCSSStyle(options);

    const inlineStyles = this.resolveInlineCSSStyle(options);
    disposer.add(this.cssManager.addClass(className, styles));
    disposer.add(this.cssManager.addClass(inlineClassName, inlineStyles));
    if (options.after) {
      const afterClassName = `${key}-after`;
      const styles = this.resolveContentCSSStyle(options.after);
      disposer.add(this.cssManager.addClass(afterClassName + '::after', styles));
      afterContentClassName = `${inlineBlockSelector} ${afterClassName}`;
    }
    if (options.before) {
      const beforeClassName = `${key}-before`;
      const styles = this.resolveContentCSSStyle(options.before);
      disposer.add(this.cssManager.addClass(beforeClassName + '::before', styles));
      beforeContentClassName = `${inlineBlockSelector} ${beforeClassName}`;
    }
    if (options.gutterIconPath) {
      const glyphMarginStyle = this.resolveCSSStyle({
        backgroundIconSize: options.gutterIconSize,
        backgroundIcon: options.gutterIconPath.toString(),
      });
      glyphMarginClassName = key + '-glyphMargin';
      disposer.add(this.cssManager.addClass(glyphMarginClassName, glyphMarginStyle));
    }

    return {
      className,
      inlineClassName,
      afterContentClassName,
      beforeContentClassName,
      glyphMarginClassName,
      overviewRulerColor: options.overviewRulerColor,
      dispose() {
        return disposer.dispose();
      },
    };
  }

  private resolveCSSStyle(styles: IThemeDecorationRenderOptions): CSSStyleDeclaration {
    const iconPath = styles.backgroundIcon?.startsWith('data:')
      ? this.iconService.encodeBase64Path(decodeURIComponent(styles.backgroundIcon))
      : styles.backgroundIcon;
    return {
      backgroundColor: this.themeService.getColorVar(styles.backgroundColor),
      background: styles.backgroundIcon ? `url("${iconPath}") center center no-repeat` : undefined,
      backgroundSize: styles.backgroundIconSize ? `${styles.backgroundIconSize}` : undefined,

      outline: styles.outline,
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,

      border: styles.border,
      borderColor: this.themeService.getColorVar(styles.borderColor),
      borderRadius: styles.borderRadius,
      borderSpacing: styles.borderSpacing,
      borderStyle: styles.borderStyle,
      borderWidth: styles.borderWidth,
    } as CSSStyleDeclaration;
  }

  private resolveInlineCSSStyle(styles: IThemeDecorationRenderOptions): CSSStyleDeclaration {
    return {
      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
      textDecoration: styles.textDecoration,
      textUnderlinePosition: styles.textUnderlinePosition,
      cursor: styles.cursor,
      color: this.themeService.getColorVar(styles.color),
      opacity: styles.opacity,
      letterSpacing: styles.letterSpacing,
    } as CSSStyleDeclaration;
  }

  private resolveContentCSSStyle(styles: IContentDecorationRenderOptions): CSSStyleDeclaration {
    let content: string | undefined;
    if (styles.contentText) {
      content = `"${styles.contentText}"`;
    } else if (styles.contentIconPath) {
      content = `url('${URI.from(styles.contentIconPath).toString(true).replace(/'/g, '%27')}')`;
    }
    return {
      display: 'block',
      content,
      border: styles.border,
      borderColor: this.themeService.getColorVar(styles.borderColor),
      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
      textDecoration: styles.textDecoration,
      color: this.themeService.getColorVar(styles.color),
      backgroundColor: this.themeService.getColorVar(styles.backgroundColor),
      margin: styles.margin,
      width: styles.width,
      height: styles.height,
    } as CSSStyleDeclaration;
  }

  static DISPLAY_INLINE_BLOCK_CLS = 'display-inline-block-decoration';
  private inlineBlockDecorationDisposer: IDisposable | undefined;

  /**
   * 最新版chrome 中 document.caretRangeFromRange 的行为有所改变
   * 如果目标位置命中的是两个 inline 元素之间, 它会认为是前一个元素的内容。
   * 在之前这个结果是属于公共父级
   * 这个改变会使得 monaco 中 hitTest 返回错误的结果，导致点击 decoration 的空白区域时会错误选中文本
   * 此处将 before 和 after 的父级 span display 强制设置为 inline-block, 可以避免这个问题, 是否会带来其他风险未知
   * @returns
   */
  private createInlineBlockCSSStyleIfNeeded(): string {
    if (this.inlineBlockDecorationDisposer) {
      return EditorDecorationCollectionService.DISPLAY_INLINE_BLOCK_CLS;
    }

    this.inlineBlockDecorationDisposer = this.cssManager.addClass(
      EditorDecorationCollectionService.DISPLAY_INLINE_BLOCK_CLS,
      { display: 'inline-block' },
    );
    return EditorDecorationCollectionService.DISPLAY_INLINE_BLOCK_CLS;
  }

  registerDecorationProvider(provider: IEditorDecorationProvider): IDisposable {
    this.decorationProviders.set(provider.key, provider);
    this.eventBus.fire(new EditorDecorationProviderRegistrationEvent(provider));
    const disposer = provider.onDidDecorationChange((uri) => {
      this.eventBus.fire(new EditorDecorationChangeEvent({ uri, key: provider.key }));
    });
    return {
      dispose: () => {
        if (this.decorationProviders.get(provider.key) === provider) {
          this.decorationProviders.delete(provider.key);
          this.eventBus.fire(new EditorDecorationTypeRemovedEvent(provider.key));
        }
        disposer.dispose();
      },
    };
  }

  async getDecorationFromProvider(
    uri: URI,
    key?: string,
  ): Promise<{ [key: string]: monaco.editor.IModelDeltaDecoration[] }> {
    const result = {};
    let decorationProviders: IEditorDecorationProvider[] = [];
    if (!key) {
      decorationProviders = Array.from(this.decorationProviders.values());
    } else {
      if (this.decorationProviders.has(key)) {
        decorationProviders.push(this.decorationProviders.get(key)!);
      }
    }
    await Promise.all(
      decorationProviders.map(async (provider) => {
        if (provider.schemes && provider.schemes.indexOf(uri.scheme) === -1) {
          return;
        }
        const decoration = await provider.provideEditorDecoration(uri);
        if (decoration) {
          result[provider.key] = decoration;
        }
      }),
    );
    return result;
  }
}
