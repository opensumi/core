import { ZoneWidget } from '@opensumi/ide-monaco-enhance';

export class GuidelineWidget extends ZoneWidget {
  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('merge-editor-guide-underline-widget');
    container.setAttribute('style', 'border-top: 1px solid #6a9955');
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
