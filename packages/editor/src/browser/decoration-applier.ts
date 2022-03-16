import clsx from 'classnames';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, URI, IEventBus, IMarkdownString } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IThemeService } from '@opensumi/ide-theme';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IDecorationRenderOptions, IDecorationApplyOptions } from '../common';

import {
  IEditorDecorationCollectionService,
  IDynamicModelDecorationProperty,
  IThemedCssStyle,
  EditorDecorationChangeEvent,
  EditorDecorationTypeRemovedEvent,
  DidApplyEditorDecorationFromProvider,
} from './types';

@Injectable({ multiple: true })
export class MonacoEditorDecorationApplier extends Disposable {
  @Autowired(IEditorDecorationCollectionService)
  decorationService: IEditorDecorationCollectionService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private decorations: Map<string, { decorations: string[]; dispose: () => void }> = new Map();

  constructor(private editor: IMonacoCodeEditor) {
    super();
    this.applyDecorationFromProvider();
    this.editor.onDidChangeModel(() => {
      this.clearDecorations();
      this.applyDecorationFromProvider();
    });
    this.editor.onDidDispose(() => {
      this.dispose();
    });
    this.addDispose(
      this.eventBus.on(EditorDecorationChangeEvent, (e) => {
        const currentUri = this.getEditorUri();
        if (currentUri && e.payload.uri.isEqual(currentUri)) {
          this.applyDecorationFromProvider(e.payload.key);
        }
      }),
    );
    this.addDispose(
      this.eventBus.on(EditorDecorationTypeRemovedEvent, (e) => {
        this.deltaDecoration(e.payload, []);
      }),
    );
  }

  private getEditorUri(): URI | null {
    if (this.editor.getModel()) {
      const uri = new URI(this.editor.getModel()!.uri.toString());
      return uri;
    } else {
      return null;
    }
  }

  private async applyDecorationFromProvider(key?: string) {
    if (this.editor.getModel()) {
      const uri = new URI(this.editor.getModel()!.uri.toString());
      const decs = await this.decorationService.getDecorationFromProvider(uri, key);
      // 由于是异步获取decoration，此时uri可能已经变了
      if (!this.editor.getModel() || this.editor.getModel()!.uri.toString() !== uri.toString()) {
        return;
      }

      for (const key of Object.keys(decs)) {
        this.deltaDecoration(key, decs[key]);
      }
      this.eventBus.fire(
        new DidApplyEditorDecorationFromProvider({
          key,
          uri,
        }),
      );
    }
  }

  dispose() {
    super.dispose();
    this.clearDecorations();
  }

  clearDecorations() {
    this.decorations.forEach((v) => {
      v.dispose();
      this.editor.deltaDecorations(v.decorations, []);
    });
    this.decorations.clear();
  }

  deltaDecoration(key: string, decorations: monaco.editor.IModelDeltaDecoration[]) {
    let oldDecorations: string[] = [];
    if (this.decorations.has(key)) {
      oldDecorations = this.decorations.get(key)!.decorations;
      this.decorations.get(key)!.dispose();
      this.decorations.delete(key);
    }
    if (oldDecorations.length === 0 && decorations.length === 0) {
      return;
    }
    const newDecoration = this.editor.deltaDecorations(oldDecorations, decorations);
    this.decorations.set(key, {
      decorations: newDecoration,
      dispose: () => null,
    });
  }

  applyDecoration(key: string, options: IDecorationApplyOptions[]) {
    const oldDecorations = this.decorations.get(key);
    if (oldDecorations) {
      oldDecorations.dispose();
    }
    const oldResult = oldDecorations ? oldDecorations.decorations : [];
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    const disposer = new Disposable();
    if (oldResult.length === 0 && options.length === 0) {
      return;
    }
    options.forEach((option) => {
      const resolved = this.resolveDecorationRenderer(key, option.renderOptions);
      newDecorations.push({
        range: option.range,
        options: {
          ...resolved.options,
          hoverMessage: resolveHoverMessage(option.hoverMessage),
        },
      });
      disposer.addDispose(resolved);
    });
    const result = this.editor.deltaDecorations(oldResult, newDecorations);
    this.decorations.set(key, {
      decorations: result,
      dispose: () => disposer.dispose(),
    });
  }

  resolveDecorationRenderer(
    key: string,
    options?: IDecorationRenderOptions,
  ): { options: monaco.editor.IModelDecorationOptions; dispose: () => void } {
    const type = this.decorationService.getTextEditorDecorationType(key);
    const result: monaco.editor.IModelDecorationOptions = {
      description: key,
    };
    const currentTheme = this.themeService.getCurrentThemeSync().type;
    const disposer = new Disposable();
    if (type) {
      const property = type.property;
      assignModelDecorationOptions(result, property, currentTheme);
    }
    if (options) {
      const tempType = this.decorationService.createTextEditorDecorationType(options);
      assignModelDecorationOptions(result, tempType.property, currentTheme);
      disposer.addDispose(tempType);
    }
    return {
      options: result,
      dispose: () => disposer.dispose(),
    };
  }
}

function assignModelDecorationOptions(
  target: monaco.editor.IModelDecorationOptions,
  property: IDynamicModelDecorationProperty,
  currentTheme: undefined | 'dark' | 'light' | 'hc',
) {
  if (property.overviewRulerLane) {
    if (!target.overviewRuler) {
      target.overviewRuler = {
        color: null as any,
        range: null as any,
        position: property.overviewRulerLane,
      };
    } else {
      target.overviewRuler.position = property.overviewRulerLane;
    }
  }

  if (property.default) {
    assignModelDecorationStyle(target, property.default);
  }
  if (currentTheme === 'dark' && property.dark) {
    assignModelDecorationStyle(target, property.dark);
  }
  if (currentTheme === 'light' && property.light) {
    assignModelDecorationStyle(target, property.light);
  }

  if (property.isWholeLine !== undefined) {
    target.isWholeLine = property.isWholeLine;
  }

  if (property.rangeBehavior) {
    target.stickiness = property.rangeBehavior as number;
  }

  target.inlineClassNameAffectsLetterSpacing = true;
}

function assignModelDecorationStyle(target: monaco.editor.IModelDecorationOptions, style: IThemedCssStyle) {
  if (style.className) {
    target.className = clsx(target.className, style.className);
  }
  if (style.inlineClassName) {
    target.inlineClassName = clsx(target.inlineClassName, style.inlineClassName);
  }
  if (style.afterContentClassName) {
    target.afterContentClassName = clsx(target.afterContentClassName, style.afterContentClassName);
  }
  if (style.beforeContentClassName) {
    target.beforeContentClassName = clsx(target.beforeContentClassName, style.beforeContentClassName);
  }
  if (style.glyphMarginClassName) {
    target.glyphMarginClassName = clsx(target.glyphMarginClassName, style.glyphMarginClassName);
  }
  if (style.overviewRulerColor) {
    if (target.overviewRuler) {
      target.overviewRuler.color = style.overviewRulerColor;
    }
  }
}

function resolveHoverMessage(
  str: IMarkdownString | IMarkdownString[] | string | undefined,
): IMarkdownString | IMarkdownString[] | undefined {
  if (!str) {
    return undefined;
  }
  if (str instanceof Array) {
    return str.map(toMarkdownString);
  } else {
    return toMarkdownString(str);
  }
}

function toMarkdownString(str: IMarkdownString | string): IMarkdownString {
  if (typeof str === 'string') {
    return {
      value: str,
      isTrusted: true,
    };
  } else {
    return str;
  }
}
