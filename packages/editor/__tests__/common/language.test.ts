import { Uri } from '@opensumi/ide-utils';

import { asMonacoDiagnostic } from '../../src/common/language';

describe('common/language', () => {
  it('asMonacoDiagnostic', () => {
    const data = asMonacoDiagnostic({
      code: '1234',
      message: 'hello',
      range: {
        start: {
          character: 0,
          line: 0,
        },
        end: {
          character: 0,
          line: 0,
        },
      },
      severity: 1,
    });
    expect(data.startColumn).toEqual(1);
    expect(data.startLineNumber).toEqual(1);
    expect(data.endColumn).toEqual(1);
    expect(data.endLineNumber).toEqual(1);
    expect(data.code).toEqual('1234');
    const uri = Uri.parse('https://www.antgroup.com');
    const data2 = asMonacoDiagnostic({
      code: {
        value: '1234',
        target: uri,
      },
      message: 'hello',
      range: {
        start: {
          character: 0,
          line: 0,
        },
        end: {
          character: 0,
          line: 0,
        },
      },
      severity: 1,
    });
    expect(data2.startColumn).toEqual(1);
    expect(data2.startLineNumber).toEqual(1);
    expect(data2.endColumn).toEqual(1);
    expect(data2.endLineNumber).toEqual(1);
    expect((data2.code as any).value).toEqual('1234');
    expect((data2.code as any).target).toEqual(uri);
  });
});
