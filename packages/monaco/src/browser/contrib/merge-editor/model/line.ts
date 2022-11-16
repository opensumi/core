import { ZoneWidget } from '@opensumi/ide-monaco-enhance';

import { LineRangeType } from '../types';

export class GuidelineWidget extends ZoneWidget {
  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('merge-editor-guide-underline-widget');
  }

  public setLineRangeType(type: LineRangeType): this {
    this.setCssClass(type);
    return this;
  }

  public showByLine(line: number): void {
    super.show(
      {
        startLineNumber: line,
        startColumn: 0,
        endLineNumber: line,
        endColumn: Number.MAX_SAFE_INTEGER,
      },
      0,
    );
  }
}
