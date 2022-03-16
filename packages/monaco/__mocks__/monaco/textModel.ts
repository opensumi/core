import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

// copied from https://github.com/microsoft/vscode/blob/master/src/vs/editor/common/model/textModel.ts

import { partialMock } from './common/util';

export function createMockedMonacoTextModelApi(): typeof textModel {
  class ModelDecorationOptions implements monaco.editor.IModelDecorationOptions {
    public static EMPTY: ModelDecorationOptions;

    public static register(options: monaco.editor.IModelDecorationOptions): ModelDecorationOptions {
      return new ModelDecorationOptions(options);
    }

    public static createDynamic(options: monaco.editor.IModelDecorationOptions): ModelDecorationOptions {
      return new ModelDecorationOptions(options);
    }

    readonly stickiness: monaco.editor.TrackedRangeStickiness;
    readonly zIndex: number;
    readonly className: string | null;
    readonly hoverMessage: monaco.IMarkdownString | monaco.IMarkdownString[] | null;
    readonly glyphMarginHoverMessage: monaco.IMarkdownString | monaco.IMarkdownString[] | null;
    readonly isWholeLine: boolean;
    readonly showIfCollapsed: boolean;
    readonly collapseOnReplaceEdit: boolean;
    readonly overviewRuler: monaco.editor.IModelDecorationOverviewRulerOptions | null;
    readonly glyphMarginClassName: string | null;
    readonly linesDecorationsClassName: string | null;
    readonly marginClassName: string | null;
    readonly inlineClassName: string | null;
    readonly inlineClassNameAffectsLetterSpacing: boolean;
    readonly beforeContentClassName: string | null;
    readonly afterContentClassName: string | null;

    private constructor(options: monaco.editor.IModelDecorationOptions) {
      this.stickiness = options.stickiness || monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
      this.zIndex = options.zIndex || 0;
      this.className = options.className ? cleanClassName(options.className) : null;
      this.hoverMessage = withUndefinedAsNull(options.hoverMessage);
      this.glyphMarginHoverMessage = withUndefinedAsNull(options.glyphMarginHoverMessage);
      this.isWholeLine = options.isWholeLine || false;
      this.overviewRuler = options.overviewRuler || null;
      this.glyphMarginClassName = options.glyphMarginClassName ? cleanClassName(options.glyphMarginClassName) : null;
      this.linesDecorationsClassName = options.linesDecorationsClassName
        ? cleanClassName(options.linesDecorationsClassName)
        : null;
      this.marginClassName = options.marginClassName ? cleanClassName(options.marginClassName) : null;
      this.inlineClassName = options.inlineClassName ? cleanClassName(options.inlineClassName) : null;
      this.inlineClassNameAffectsLetterSpacing = options.inlineClassNameAffectsLetterSpacing || false;
      this.beforeContentClassName = options.beforeContentClassName
        ? cleanClassName(options.beforeContentClassName)
        : null;
      this.afterContentClassName = options.afterContentClassName ? cleanClassName(options.afterContentClassName) : null;
    }
    description: string;
    minimap?: monaco.editor.IModelDecorationMinimapOptions | null | undefined;
    firstLineDecorationClassName?: string | null | undefined;
    after?: monaco.editor.InjectedTextOptions | null | undefined;
    before?: monaco.editor.InjectedTextOptions | null | undefined;
  }

  const mockedMonacoTextModelApi: any = {
    ModelDecorationOptions,
  };

  return partialMock('monaco.textModel', mockedMonacoTextModelApi);
}

function cleanClassName(className: string): string {
  return className.replace(/[^a-z0-9\-_]/gi, ' ');
}

function withUndefinedAsNull<T>(x: T | undefined): T | null {
  return typeof x === 'undefined' ? null : x;
}
