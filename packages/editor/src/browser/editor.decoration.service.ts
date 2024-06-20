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
    const disposer = new DisposableStore();

    const defaultStyle = this.addedThemeDecorationToCSSStyleSheet(key, options);
    const result = {
      default: defaultStyle,
      light: null,
      dark: null,
      dispose: () => {
        disposer.dispose();
      },
      isWholeLine: options.isWholeLine || false,
      overviewRulerLane: options.overviewRulerLane,
    } as IDynamicModelDecorationProperty;

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

    const styles = this.resolveCSSStyle(options);
    disposer.add(this.cssManager.addClass(className, styles));

    const inlineStyles = this.resolveInlineCSSStyle(options);
    let _inlineClassNameAffectsLetterSpacing = inlineStyles.letterSpacing !== undefined;
    const inlineInsertResult = this.cssManager.addClass(inlineClassName, inlineStyles);
    if (inlineInsertResult.index !== -1) {
      _inlineClassNameAffectsLetterSpacing = true;
    }
    disposer.add(inlineInsertResult);

    if (options.after) {
      afterContentClassName = `${key}-after`;
      const styles = this.resolveContentCSSStyle(options.after, 'inline-block');
      const insertResult = this.cssManager.addClass(afterContentClassName + '::after', styles);

      disposer.add(insertResult);
    }
    if (options.before) {
      beforeContentClassName = `${key}-before`;
      const styles = this.resolveContentCSSStyle(options.before, 'inline-block');
      const insertResult = this.cssManager.addClass(beforeContentClassName + '::before', styles);

      disposer.add(insertResult);
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
      inlineClassNameAffectsLetterSpacing: _inlineClassNameAffectsLetterSpacing,
      dispose() {
        return disposer.dispose();
      },
    };
  }

  private resolveCSSStyle(styles: IThemeDecorationRenderOptions): CSSStyleDeclaration {
    const iconPath = styles.backgroundIcon?.startsWith('data:')
      ? this.iconService.encodeBase64Path(decodeURIComponent(styles.backgroundIcon))
      : styles.backgroundIcon;

    const result = {} as Partial<CSSStyleDeclaration>;

    if (styles.backgroundColor) {
      result.backgroundColor = this.themeService.getColorVar(styles.backgroundColor);
    }
    if (styles.backgroundIcon) {
      result.background = styles.backgroundIcon ? `url("${iconPath}") center center no-repeat` : undefined;
    }
    if (styles.backgroundIconSize) {
      result.backgroundSize = styles.backgroundIconSize;
    }

    if (styles.outline) {
      result.outline = styles.outline;
    }
    if (styles.outlineColor) {
      result.outlineColor = this.themeService.getColorVar(styles.outlineColor);
    }
    if (styles.outlineStyle) {
      result.outlineStyle = styles.outlineStyle;
    }
    if (styles.outlineWidth) {
      result.outlineWidth = styles.outlineWidth;
    }
    if (styles.border) {
      result.border = styles.border;
    }
    if (styles.borderColor) {
      result.borderColor = this.themeService.getColorVar(styles.borderColor);
    }
    if (styles.borderRadius) {
      result.borderRadius = styles.borderRadius;
    }
    if (styles.borderSpacing) {
      result.borderSpacing = styles.borderSpacing;
    }
    if (styles.borderStyle) {
      result.borderStyle = styles.borderStyle;
    }
    if (styles.borderWidth) {
      result.borderWidth = styles.borderWidth;
    }

    return result as CSSStyleDeclaration;
  }

  private resolveInlineCSSStyle(styles: IThemeDecorationRenderOptions): CSSStyleDeclaration {
    const result = {} as Partial<CSSStyleDeclaration>;
    if (styles.fontStyle) {
      result.fontStyle = styles.fontStyle;
    }
    if (styles.fontWeight) {
      result.fontWeight = styles.fontWeight;
    }
    if (styles.textDecoration) {
      result.textDecoration = styles.textDecoration;
    }
    if (styles.textUnderlinePosition) {
      result.textUnderlinePosition = styles.textUnderlinePosition;
    }
    if (styles.cursor) {
      result.cursor = styles.cursor;
    }
    if (styles.color) {
      result.color = this.themeService.getColorVar(styles.color);
    }
    if (styles.opacity) {
      result.opacity = styles.opacity;
    }
    if (styles.letterSpacing) {
      result.letterSpacing = styles.letterSpacing;
    }

    return result as CSSStyleDeclaration;
  }

  private resolveContentCSSStyle(styles: IContentDecorationRenderOptions, display = 'block'): CSSStyleDeclaration {
    let content: string | undefined;
    if (styles.contentText) {
      content = `"${styles.contentText}"`;
    } else if (styles.contentIconPath) {
      content = `url('${URI.from(styles.contentIconPath).toString(true).replace(/'/g, '%27')}')`;
    }

    const result = {
      display,
      content,
    } as Partial<CSSStyleDeclaration>;

    if (styles.border) {
      result.border = styles.border;
    }
    if (styles.borderColor) {
      result.borderColor = this.themeService.getColorVar(styles.borderColor);
    }
    if (styles.fontStyle) {
      result.fontStyle = styles.fontStyle;
    }
    if (styles.fontWeight) {
      result.fontWeight = styles.fontWeight;
    }
    if (styles.textDecoration) {
      result.textDecoration = styles.textDecoration;
    }
    if (styles.color) {
      result.color = this.themeService.getColorVar(styles.color);
    }
    if (styles.backgroundColor) {
      result.backgroundColor = this.themeService.getColorVar(styles.backgroundColor);
    }
    if (styles.margin) {
      result.margin = styles.margin;
    }
    if (styles.width) {
      result.width = styles.width;
    }
    if (styles.height) {
      result.height = styles.height;
    }

    return result as CSSStyleDeclaration;
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
