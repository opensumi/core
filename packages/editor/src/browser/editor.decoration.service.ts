import { Autowired, Injectable } from '@opensumi/di';
import { URI, IDisposable, Disposable, IEventBus } from '@opensumi/ide-core-browser';
import { IThemeService } from '@opensumi/ide-theme';
import { ICSSStyleService } from '@opensumi/ide-theme/lib/common/style';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IThemeDecorationRenderOptions, IDecorationRenderOptions, IContentDecorationRenderOptions } from '../common';


import {
  IEditorDecorationCollectionService,
  IBrowserTextEditorDecorationType,
  IDynamicModelDecorationProperty,
  IThemedCssStyle,
  IEditorDecorationProvider,
  EditorDecorationProviderRegistrationEvent,
  EditorDecorationChangeEvent,
  EditorDecorationTypeRemovedEvent,
} from './types';

@Injectable()
export class EditorDecorationCollectionService implements IEditorDecorationCollectionService {
  decorations: Map<string, IBrowserTextEditorDecorationType> = new Map();

  @Autowired(ICSSStyleService)
  cssManager: ICSSStyleService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private tempId = 0;

  constructor() {}

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
    const dec = {
      default: this.addedThemeDecorationToCSSStyleSheet(key, options),
      light: options.light ? this.addedThemeDecorationToCSSStyleSheet(key + '-light', options.light) : null,
      dark: options.dark ? this.addedThemeDecorationToCSSStyleSheet(key + '-dark', options.dark) : null,
      isWholeLine: options.isWholeLine || false,
      overviewRulerLane: options.overviewRulerLane,
      dispose: () => {
        dec.default.dispose();
        if (dec.light) {
          dec.light.dispose();
        }
        if (dec.dark) {
          dec.dark.dispose();
        }
      },
    };

    return dec;
  }

  private addedThemeDecorationToCSSStyleSheet(key, options: IThemeDecorationRenderOptions): IThemedCssStyle {
    const className = key;
    const inlineClassName = key + '-inline';
    const disposer = new Disposable();
    let afterContentClassName;
    let beforeContentClassName;
    let glyphMarginClassName;
    const styles = this.resolveCSSStyle(options);

    const inlineStyles = this.resolveInlineCSSStyle(options);
    disposer.addDispose(this.cssManager.addClass(className, styles));
    disposer.addDispose(this.cssManager.addClass(inlineClassName, inlineStyles));
    if (options.after) {
      const styles = this.resolveContentCSSStyle(options.after);
      disposer.addDispose(this.cssManager.addClass(key + '-after::after', styles));
      afterContentClassName = key + '-after';
      // 最新版chrome 中 document.caretRangeFromRange 的行为有所改变
      // 如果目标位置命中的是两个inline元素之间, 它会认为是前一个元素的内容。
      // 在之前这个结果是属于公共父级
      // 这个改变会使得monaco中hitTest返回错误的结果，导致点击decoration的空白区域时会错误选中文本
      // 临时修复:
      // 此处将before和after的父级span display强制设置为inline-block, 可以避免这个问题, 是否会带来其他风险未知
      disposer.addDispose(this.cssManager.addClass(afterContentClassName, { display: 'inline-block' } as any));
    }
    if (options.before) {
      const styles = this.resolveContentCSSStyle(options.before);
      disposer.addDispose(this.cssManager.addClass(key + '-before::before', styles));
      beforeContentClassName = key + '-before';
      disposer.addDispose(this.cssManager.addClass(beforeContentClassName, { display: 'inline-block' } as any));
    }
    if (options.gutterIconPath) {
      const glyphMarginStyle = this.resolveCSSStyle({
        backgroundIconSize: options.gutterIconSize,
        backgroundIcon: options.gutterIconPath.toString(),
      });
      glyphMarginClassName = key + '-glyphMargin';
      disposer.addDispose(this.cssManager.addClass(glyphMarginClassName, glyphMarginStyle));
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
    return {
      backgroundColor: this.themeService.getColorVar(styles.backgroundColor),
      background: styles.backgroundIcon ? `url('${styles.backgroundIcon}') center center no-repeat` : undefined,
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
