import { rePath } from '../../src/browser/terminal.addon';

describe('Match paths', () => {
  it('match unix paths', () => {
    expect(rePath.test('abc')).toBeFalsy();
    expect(rePath.test('abc/def')).toBeTruthy();
    expect(rePath.test('/abc/def')).toBeTruthy();
  });

  it('match unix paths with positions', () => {
    expect(rePath.test('/abc/def:1')).toBeTruthy();
    expect(rePath.test('/abc/def:1:2')).toBeTruthy();
    expect(rePath.test('/abc/def(1)')).toBeTruthy();
    expect(rePath.test('/abc/def(1,2)')).toBeTruthy();
    expect(rePath.test('/abc/def (1,2)')).toBeTruthy();
  });

  it('match windows paths', () => {
    expect(rePath.test('C:\\abc')).toBeFalsy();
    expect(rePath.test('c:\\abc')).toBeFalsy();
    expect(rePath.test('C:\\abc\\def')).toBeTruthy();
    expect(rePath.test('c:\\abc\\def')).toBeTruthy();
    expect(rePath.test('abc')).toBeFalsy();
    expect(rePath.test('abc\\def')).toBeTruthy();
  });

  it('match windows paths with positions', () => {
    expect(rePath.test('c:\\abc\\def:1')).toBeTruthy();
    expect(rePath.test('c:\\abc\\def:1:2')).toBeTruthy();
    expect(rePath.test('c:\\abc\\def(1)')).toBeTruthy();
    expect(rePath.test('c:\\abc\\def(1,2)')).toBeTruthy();
    expect(rePath.test('c:\\abc\\def (1,2)')).toBeTruthy();
  });
});
