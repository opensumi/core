import { partialMock, quickEvent } from './common/util';

export function createMockedMonacoRamgeApi(): typeof monaco.Range {
  const mockedMonacoRangeApi: Partial<typeof monaco.Range> = {
    // lift(range: undefined | null): null;
    // lift(range: monaco.IRange): monaco.Range;
    lift(range?: monaco.IRange | null): any {
      if (!range) {
        return null;
      }

      return range as monaco.Range;
    },
  };

  return partialMock('monaco.Range', mockedMonacoRangeApi);
}
