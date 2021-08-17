import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';

import { partialMock } from './common/util';

export function createMockedMonacoPositionApi(): typeof monaco.Position {
  class MockedMonacoPosition {
    constructor(public lineNumber: number, public column: number) {}
  }
  const mockedMonacoPositionApi: any = MockedMonacoPosition;

  return partialMock('monaco.Position', mockedMonacoPositionApi);
}
