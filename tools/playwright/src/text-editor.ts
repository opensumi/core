import { ElementHandle, Page } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';
import { OpenSumiEditor } from './editor';
import { OpenSumiTreeNode } from './tree-node';
import { keypressWithCmdCtrl, keypressWithCmdCtrlAndShift } from './utils';

abstract class ViewsModel {
  constructor(readonly page: Page) {}
  protected viewElement: ElementHandle<SVGElement | HTMLElement> | null;
  async mount(v: ElementHandle<SVGElement | HTMLElement> | null): Promise<void> {
    this.viewElement = v;
  }
}

class GlyphMarginModel extends ViewsModel {
  async getElement() {
    const glyphMargin = await this.viewElement?.$('.glyph-margin');
    const parent = await glyphMargin?.getProperty('parentNode');
    return parent?.asElement();
  }

  async getOverlay(lineNumber: number) {
    const margin = await this.getElement();
    const overlays = await margin?.$$('.margin-view-overlays > div');
    if (!overlays) {
      return;
    }

    for (const node of overlays) {
      const lineNode = await node.$('.line-numbers');
      const content = await lineNode?.textContent();
      if (content === lineNumber.toString()) {
        return node;
      }
    }
  }

  /**
   * monaco 0.45 版本将断点 dom 放在了 glyph-margin-widgets 的 dom 里
   */
  async getGlyphMarginWidgets(lineNumber: number) {
    const margin = await this.getElement();
    const widgets = await margin?.$$('.glyph-margin-widgets > div');
    if (!widgets) {
      return;
    }

    for (const node of widgets) {
      const styles = await node.getAttribute('style');

      const tops = styles?.match(/top: [0-9]*px;/g) || ['0'];
      const topNums = tops[0].match(/\d+/g);

      const height = styles?.match(/height: [0-9]*px;/g) || ['0'];
      const heightNums = height[0].match(/\d+/g);
      if (Array.isArray(topNums) && topNums.length > 0 && Array.isArray(heightNums) && heightNums.length > 0) {
        let topNum: number | string = topNums[0];
        topNum = Number(topNum);

        let heightNum: number | string = heightNums[0];
        heightNum = Number(heightNum);

        const line = topNum / heightNum + 1;
        if (line === lineNumber) {
          return node;
        }
      } else {
        return;
      }
    }
  }

  async hasBreakpoint(node: ElementHandle<SVGElement | HTMLElement>): Promise<boolean> {
    const className = await node.getProperty('className');
    const classValue = await className.jsonValue();
    return classValue.includes('sumi-debug-breakpoint');
  }

  async hasTopStackFrame(node: ElementHandle<SVGElement | HTMLElement>): Promise<boolean> {
    const className = await node.getProperty('className');
    const classValue = await className.jsonValue();
    return classValue.includes('sumi-debug-top-stack-frame');
  }

  async hasTopStackFrameLine(node: ElementHandle<SVGElement | HTMLElement>): Promise<boolean> {
    return !!(await node.$('.sumi-debug-top-stack-frame-line'));
  }
}

class OverlaysModel extends ViewsModel {
  async getElement() {
    return await this.viewElement?.$('.view-overlays');
  }

  async getOverlay(lineNumber: number) {
    const element = await this.getElement();
    const overlay = await element?.$(`div:nth-child(${lineNumber})`);
    return overlay;
  }
}

export class OpenSumiTextEditor extends OpenSumiEditor {
  private glyphMarginModel: GlyphMarginModel;
  private overlaysModel: OverlaysModel;

  constructor(app: OpenSumiApp, filestatElement: OpenSumiTreeNode) {
    super(app, filestatElement);
    this.glyphMarginModel = new GlyphMarginModel(this.page);
    this.overlaysModel = new OverlaysModel(this.page);
  }

  async getGlyphMarginModel() {
    const viewElement = await this.getViewElement();
    this.glyphMarginModel.mount(viewElement);
    return this.glyphMarginModel;
  }

  async getOverlaysModel() {
    const viewElement = await this.getViewElement();
    this.overlaysModel.mount(viewElement);
    return this.overlaysModel;
  }

  async openLineContextMenuByLineNumber(lineNumber: number) {
    const existingLine = await this.lineByLineNumber(lineNumber);
    if (!existingLine) {
      return;
    }
    return OpenSumiContextMenu.open(this.app, async () => existingLine);
  }

  async openGlyphMarginContextMenu() {
    const glyphMargin = await this.getGlyphMarginModel();
    const view = await glyphMargin.getElement();
    if (!view) {
      return;
    }
    return OpenSumiContextMenu.open(this.app, async () => view);
  }

  async openTabContextMenu() {
    const view = await this.getTab();
    if (!view) {
      return;
    }
    return OpenSumiContextMenu.open(this.app, async () => view);
  }

  async numberOfLines(): Promise<number | undefined> {
    await this.activate();
    const viewElement = await this.getViewElement();
    const lineElements = await viewElement?.$$('.view-lines .view-line');
    return lineElements?.length;
  }

  async textContentOfLineByLineNumber(lineNumber: number): Promise<string | undefined> {
    const lineElement = await this.lineByLineNumber(lineNumber);
    const content = await lineElement?.textContent();
    return content ? this.replaceEditorSymbolsWithSpace(content) : undefined;
  }

  async replaceLineWithLineNumber(text: string, lineNumber: number): Promise<void> {
    await this.selectLineWithLineNumber(lineNumber);
    await this.typeTextAndHitEnter(text);
  }

  protected async typeTextAndHitEnter(text: string): Promise<void> {
    await this.page.keyboard.type(text);
    await this.page.keyboard.press('Enter');
  }

  async typeText(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }
  async saveByKeyboard(): Promise<void> {
    await this.page.keyboard.press(keypressWithCmdCtrl('s'));
    await this.waitForEditorDone();
  }
  async undoByKeyboard(): Promise<void> {
    await this.page.keyboard.press(keypressWithCmdCtrl('z'));
    await this.waitForEditorDone();
  }
  async redoByKeyboard(): Promise<void> {
    await this.page.keyboard.press(keypressWithCmdCtrlAndShift('z'));
    await this.waitForEditorDone();
  }

  async selectLineWithLineNumber(lineNumber: number): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const lineElement = await this.lineByLineNumber(lineNumber);
    await this.selectLine(lineElement);
    return lineElement;
  }

  async placeCursorInLineWithLineNumber(
    lineNumber: number,
  ): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const lineElement = await this.lineByLineNumber(lineNumber);
    await this.placeCursorInLine(lineElement);
    return lineElement;
  }

  async placeCursorInLineWithPosition(
    lineNumber: number,
    columnNumber: number,
  ): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const lineElement = await this.lineByLineNumber(lineNumber);
    await this.placeCursorInLine(lineElement, 'start');
    for (let i = 0; i < columnNumber; i++) {
      await this.page.keyboard.press('ArrowRight', { delay: 200 });
    }
    return lineElement;
  }

  async deleteLineByLineNumber(lineNumber: number): Promise<void> {
    await this.selectLineWithLineNumber(lineNumber);
    await this.page.keyboard.press('Backspace');
  }

  async getGlyphMarginElement() {
    await this.activate();
    const viewElement = await this.getViewElement();
    return await viewElement?.$('.glyph-margin');
  }

  async getCursorElement(): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    const viewElement = await this.getViewElement();

    const cursorNode = await viewElement?.$('.cursor.monaco-mouse-cursor-text');
    if (cursorNode) {
      return cursorNode;
    }
  }

  async getCursorLineNumber(node: ElementHandle<SVGElement | HTMLElement> | undefined) {
    const style = await node!.getAttribute('style');
    const tops = style?.match(/top: [0-9]*px;/g) || ['0'];
    const topNums = tops[0].match(/\d+/g);
    if (topNums && topNums.length > 0) {
      let topNum: number | string = topNums[0];
      topNum = Number(topNum);

      // 每个 view-lines 默认高度都是 18
      const line = topNum / 18 + 1;
      return line;
    }
    return undefined;
  }
  async lineByLineNumber(lineNumber: number): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const viewElement = await this.getViewElement();

    const lineNode = await viewElement!.$(`.view-lines > div:nth-child(${lineNumber})`);

    if (!lineNode) {
      throw new Error(`Couldn't retrieve lines of text editor ${this.tabSelector}`);
    }
    return lineNode.asElement();
  }

  async textContentOfLineContainingText(text: string): Promise<string | undefined> {
    await this.activate();
    const lineElement = await this.lineContainingText(text);
    const content = await lineElement?.textContent();
    return content ? this.replaceEditorSymbolsWithSpace(content) : undefined;
  }

  async replaceLineContainingText(newText: string, oldText: string): Promise<void> {
    await this.selectLineContainingText(oldText);
    await this.typeTextAndHitEnter(newText);
  }

  async selectLineContainingText(text: string): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const lineElement = await this.lineContainingText(text);
    await this.selectLine(lineElement);
    return lineElement;
  }

  async placeCursorInLineContainingText(text: string): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    await this.activate();
    const lineElement = await this.lineContainingText(text);
    await this.placeCursorInLine(lineElement);
    return lineElement;
  }

  async deleteLineContainingText(text: string): Promise<void> {
    await this.selectLineContainingText(text);
    await this.page.keyboard.press('Backspace');
  }

  async addTextToNewLineAfterLineContainingText(textContainedByExistingLine: string, newText: string): Promise<void> {
    const existingLine = await this.lineContainingText(textContainedByExistingLine);
    await this.placeCursorInLine(existingLine);
    await this.page.keyboard.press('End');
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(newText);
  }

  async addTextToNewLineAfterLineByLineNumber(lineNumber: number, newText: string): Promise<void> {
    const existingLine = await this.lineByLineNumber(lineNumber);
    await this.placeCursorInLine(existingLine);
    await this.page.keyboard.press('End');
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(newText, { delay: 100 });
  }

  async pasteContentAfterLineByLineNumber(lineNumber: number): Promise<void> {
    const existingLine = await this.lineByLineNumber(lineNumber);
    await this.placeCursorInLine(existingLine);
    await this.page.keyboard.press('End');
    await this.page.keyboard.press(keypressWithCmdCtrl('KeyV'));
  }

  protected async lineContainingText(text: string): Promise<ElementHandle<SVGElement | HTMLElement> | undefined> {
    const viewElement = await this.getViewElement();
    return viewElement?.waitForSelector(`.view-lines .view-line:has-text("${text}")`);
  }

  protected async selectLine(lineElement: ElementHandle<SVGElement | HTMLElement> | undefined): Promise<void> {
    await lineElement?.click({ clickCount: 3 });
  }

  async placeCursorInLine(
    lineElement: ElementHandle<SVGElement | HTMLElement> | undefined,
    point: 'start' | 'end' = 'end',
  ): Promise<void> {
    if (!lineElement) {
      return;
    }

    if (point === 'start') {
      await lineElement.click({
        position: { x: 0, y: 0 },
      });
      return;
    }

    await lineElement.click();
  }

  protected replaceEditorSymbolsWithSpace(content: string): string | Promise<string | undefined> {
    // [ ] &nbsp; => \u00a0
    // [·] &middot; => \u00b7
    return content.replace(/[\u00a0\u00b7]/g, ' ');
  }

  protected async selectedSuggestion(): Promise<ElementHandle<SVGElement | HTMLElement>> {
    return this.page.waitForSelector(this.viewSelector + ' .monaco-list-row.show-file-icons.focused');
  }

  async getSelectedSuggestionText(): Promise<string> {
    const suggestion = await this.selectedSuggestion();
    const text = await suggestion.textContent();
    if (text === null) {
      throw new Error('Text content could not be found');
    }
    return text;
  }

  async clearContent() {
    const line = await this.lineByLineNumber(1);
    await line?.click();
    await this.placeCursorInLine(line);
    await this.page.keyboard.press(keypressWithCmdCtrl('KeyA'));
    await this.page.keyboard.press('Delete');
  }
}
