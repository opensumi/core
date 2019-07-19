import { Autowired, Injectable } from '@ali/common-di';
import { IEditorDecorationCollectionService, IDynamicModelDecorationProperty, IThemedCssStyle } from './types';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { IDecorationRenderOptions, IDecorationApplyOptions, IMarkdownString } from '../common';
import { Disposable } from '@ali/ide-core-common';

@Injectable({multiple: true})
export class MonacoEditorDecorationApplier extends Disposable {

  @Autowired(IEditorDecorationCollectionService)
  decorationService: IEditorDecorationCollectionService;

  @Autowired(WorkbenchThemeService)
  themeService: WorkbenchThemeService;

  private decorations: Map<string, { decorations: string[], dispose: () => void } > = new Map();

  constructor(private editor: monaco.editor.ICodeEditor) {
    super();
    this.editor.onDidChangeModel(() => {
      this.clearDecorations();
    });
    this.editor.onDidDispose(() => {
      this.dispose();
    });
  }

  dispose() {
    super.dispose();
    this.clearDecorations();
  }

  clearDecorations() {
    this.decorations.forEach((v) => {
      v.dispose();
    });
    this.decorations.clear();
  }

  applyDecoration(key: string, options: IDecorationApplyOptions[]) {
    const oldDecorations = this.decorations.get(key);
    if (oldDecorations) {
      oldDecorations.dispose();
    }
    const oldResult = oldDecorations ? oldDecorations.decorations : [];
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    const disposer = new Disposable();
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

  resolveDecorationRenderer(key, options?: IDecorationRenderOptions): { options: monaco.editor.IModelDecorationOptions, dispose: () => void }  {
    const type = this.decorationService.getTextEditorDecorationType(key);
    const result: monaco.editor.IModelDecorationOptions = {} ;
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

function assignModelDecorationOptions(target: monaco.editor.IModelDecorationOptions, property: IDynamicModelDecorationProperty, currentTheme: undefined | 'dark' | 'light' | 'hc' ) {
  if (property.overviewRulerLane) {
    if (!target.overviewRuler) {
      target.overviewRuler = {
        color: null as any,
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

}

function assignModelDecorationStyle(target: monaco.editor.IModelDecorationOptions, style: IThemedCssStyle) {
  if (style.className) {
    target.className = target.className ? target.className + ' ' + style.className : style.className;
  }
  if (style.afterContentClassName) {
    target.afterContentClassName += target.afterContentClassName ? target.afterContentClassName + ' ' + style.afterContentClassName : style.afterContentClassName;
  }
  if (style.beforeContentClassName) {
    target.beforeContentClassName += target.beforeContentClassName ? target.beforeContentClassName + ' ' + style.beforeContentClassName : style.beforeContentClassName;
  }
  if (style.overviewRulerColor) {
    if (target.overviewRuler) {
      target.overviewRuler.color = style.overviewRulerColor;
    }
  }
}

function resolveHoverMessage(str: IMarkdownString | IMarkdownString [] | string | undefined ): IMarkdownString | IMarkdownString[] | undefined {
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
