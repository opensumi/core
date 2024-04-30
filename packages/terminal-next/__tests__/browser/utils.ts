import { IBufferCell, IBufferLine } from '@xterm/xterm';

export async function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const TEST_WIDE_CHAR = '文';
const TEST_NULL_CHAR = 'C';

export function createBufferLineArray(lines: { text: string; width: number }[]): IBufferLine[] {
  const result: IBufferLine[] = [];
  lines.forEach((l, i) => {
    result.push(new TestBufferLine(l.text, l.width, i + 1 !== lines.length));
  });
  return result;
}

class TestBufferLine implements IBufferLine {
  constructor(private _text: string, public length: number, public isWrapped: boolean) {}
  getCell(x: number): IBufferCell | undefined {
    // Create a fake line of cells and use that to resolve the width
    const cells: string[] = [];
    let wideNullCellOffset = 0; // There is no null 0 width char after a wide char
    const emojiOffset = 0; // Skip chars as emoji are multiple characters
    for (let i = 0; i <= x - wideNullCellOffset + emojiOffset; i++) {
      let char = this._text.charAt(i);
      if (char === '\ud83d') {
        // Make "🙂"
        char += '\ude42';
      }
      cells.push(char);
      if (this._text.charAt(i) === TEST_WIDE_CHAR) {
        // Skip the next character as it's width is 0
        cells.push(TEST_NULL_CHAR);
        wideNullCellOffset++;
      }
    }
    return {
      getChars: () => (x >= cells.length ? '' : cells[x]),
      getWidth: () => {
        switch (cells[x]) {
          case TEST_WIDE_CHAR:
            return 2;
          case TEST_NULL_CHAR:
            return 0;
          default:
            return 1;
        }
      },
    } as any;
  }
  translateToString(): string {
    return this._text;
  }
}
