import { convertLinkRangeToBuffer } from '../../../src/browser/links/helpers';
import { createBufferLineArray } from '../utils';

describe('convertLinkRangeToBuffer', () => {
  test('should convert ranges for ascii characters', () => {
    const lines = createBufferLineArray([
      { text: 'AA http://t', width: 11 },
      { text: '.com/f/', width: 8 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4, startLineNumber: 1, endColumn: 19, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 1 },
      end: { x: 7, y: 2 },
    });
  });
  test('should convert ranges for wide characters before the link', () => {
    const lines = createBufferLineArray([
      { text: 'A文 http://', width: 11 },
      { text: 't.com/f/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4, startLineNumber: 1, endColumn: 19, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4 + 1, y: 1 },
      end: { x: 7 + 1, y: 2 },
    });
  });
  test('should convert ranges for combining characters before the link', () => {
    const lines = createBufferLineArray([
      { text: 'A🙂 http://', width: 11 },
      { text: 't.com/f/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4 + 1, startLineNumber: 1, endColumn: 19 + 1, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 1 },
      end: { x: 7, y: 2 },
    });
  });
  test('should convert ranges for wide characters inside the link', () => {
    const lines = createBufferLineArray([
      { text: 'AA http://t', width: 11 },
      { text: '.com/文/', width: 8 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4, startLineNumber: 1, endColumn: 19, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 1 },
      end: { x: 7 + 1, y: 2 },
    });
  });
  test('should convert ranges for wide characters before and inside the link', () => {
    const lines = createBufferLineArray([
      { text: 'A文 http://', width: 11 },
      { text: 't.com/文/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4, startLineNumber: 1, endColumn: 19, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4 + 1, y: 1 },
      end: { x: 7 + 2, y: 2 },
    });
  });
  test('should convert ranges for emoji before before and wide inside the link', () => {
    const lines = createBufferLineArray([
      { text: 'A🙂 http://', width: 11 },
      { text: 't.com/文/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 4 + 1, startLineNumber: 1, endColumn: 19 + 1, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 1 },
      end: { x: 7 + 1, y: 2 },
    });
  });
  test('should convert ranges for ascii characters (link starts on wrapped)', () => {
    const lines = createBufferLineArray([
      { text: 'AAAAAAAAAAA', width: 11 },
      { text: 'AA http://t', width: 11 },
      { text: '.com/f/', width: 8 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 30, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 2 },
      end: { x: 7, y: 3 },
    });
  });
  test('should convert ranges for wide characters before the link (link starts on wrapped)', () => {
    const lines = createBufferLineArray([
      { text: 'AAAAAAAAAAA', width: 11 },
      { text: 'A文 http://', width: 11 },
      { text: 't.com/f/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 30, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4 + 1, y: 2 },
      end: { x: 7 + 1, y: 3 },
    });
  });
  test('should convert ranges for wide characters inside the link (link starts on wrapped)', () => {
    const lines = createBufferLineArray([
      { text: 'AAAAAAAAAAA', width: 11 },
      { text: 'AA http://t', width: 11 },
      { text: '.com/文/', width: 8 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 30, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4, y: 2 },
      end: { x: 7 + 1, y: 3 },
    });
  });
  test('should convert ranges for wide characters before and inside the link', () => {
    const lines = createBufferLineArray([
      { text: 'AAAAAAAAAAA', width: 11 },
      { text: 'A文 http://', width: 11 },
      { text: 't.com/文/', width: 9 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 30, endLineNumber: 1 },
      0,
    );
    expect(bufferRange).toEqual({
      start: { x: 4 + 1, y: 2 },
      end: { x: 7 + 2, y: 3 },
    });
  });
  test('should convert ranges for several wide characters before the link', () => {
    const lines = createBufferLineArray([
      { text: 'A文文AAAAAA', width: 11 },
      { text: 'AA文文 http', width: 11 },
      { text: '://t.com/f/', width: 11 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 30, endLineNumber: 1 },
      0,
    );
    // This test ensures that the start offset is applies to the end before it's counted
    expect(bufferRange).toEqual({
      start: { x: 4 + 4, y: 2 },
      end: { x: 7 + 4, y: 3 },
    });
  });
  test('should convert ranges for several wide characters before and inside the link', () => {
    const lines = createBufferLineArray([
      { text: 'A文文AAAAAA', width: 11 },
      { text: 'AA文文 http', width: 11 },
      { text: '://t.com/文', width: 11 },
      { text: '文/', width: 3 },
    ]);
    const bufferRange = convertLinkRangeToBuffer(
      lines,
      11,
      { startColumn: 15, startLineNumber: 1, endColumn: 31, endLineNumber: 1 },
      0,
    );
    // This test ensures that the start offset is applies to the end before it's counted
    expect(bufferRange).toEqual({
      start: { x: 4 + 4, y: 2 },
      end: { x: 2, y: 4 },
    });
  });
});
