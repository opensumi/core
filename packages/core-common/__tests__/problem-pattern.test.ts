import { diagnosticAreEquals } from '../src/problem-pattern';

describe('problem pattern', () => {
  it('diagnosticAreEquals should return true', () => {
    const d1 = {
      code: 'code',
      message: 'message',
      source: 'source',
      range: {
        start: {
          line: 1,
          character: 1,
        },
        end: {
          line: 1,
          character: 1,
        },
      },
    };
    const d2 = {
      code: 'code',
      message: 'message',
      source: 'source',
      range: {
        start: {
          line: 1,
          character: 1,
        },
        end: {
          line: 1,
          character: 1,
        },
      },
    };
    expect(diagnosticAreEquals(d1 as any, d2 as any)).toBe(true);
  });
  it('diagnosticAreEquals(code.target) should return true', () => {
    const d1 = {
      code: {
        target: 'https://antgroup.com',
        value: 'code',
      },
      message: 'message',
      range: {
        start: {
          line: 1,
          character: 1,
        },
        end: {
          line: 1,
          character: 1,
        },
      },
    };
    const d2 = {
      code: {
        target: 'https://antgroup.com',
        value: 'code',
      },
      message: 'message',
      range: {
        start: {
          line: 1,
          character: 1,
        },
        end: {
          line: 1,
          character: 1,
        },
      },
    };
    expect(diagnosticAreEquals(d1 as any, d2 as any)).toBe(true);
  });
  it('diagnosticAreEquals(null range) should return true', () => {
    const d1 = {
      code: {
        target: 'https://antgroup.com',
        value: 'code',
      },
      message: 'message',
    };
    const d2 = {
      code: {
        target: 'https://antgroup.com',
        value: 'code',
      },
      message: 'message',
    };
    expect(diagnosticAreEquals(d1 as any, d2 as any)).toBe(true);
  });
});
