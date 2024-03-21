import * as monaco from '../../src/common';

import { partialMock } from './common/util';

export function createMockedMonacoPositionApi(): typeof monaco.Position {
  class MockedMonacoPosition {
    constructor(public lineNumber: number, public column: number) {}
  }
  const mockedMonacoPositionApi: any = MockedMonacoPosition;

  return partialMock('Position', mockedMonacoPositionApi);
}
