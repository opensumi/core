import { IRPCProtocol } from '@opensumi/ide-connection';
import { Uri } from '@opensumi/ide-core-common';
import { MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import {
  IEditorTabDto,
  IMainThreadEditorTabsShape,
  TabInputKind,
  TabModelOperationKind,
} from '@opensumi/ide-extension/lib/common/vscode/editor-tabs';
import { ExtHostEditorTabs } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.editor-tabs';

describe('ExtHostEditorTabs', () => {
  it('refreshes the existing tab API object when a move changes pinned state', () => {
    const map = new Map();
    const rpcProtocol: IRPCProtocol = {
      getProxy: (key) => map.get(key),
      set: (key, value) => {
        map.set(key, value);
        return value;
      },
      get: (key) => map.get(key),
    };
    const mainThread: IMainThreadEditorTabsShape = {
      $initializeState: jest.fn(),
      $moveTab: jest.fn(),
      $closeTab: jest.fn(),
      $closeGroup: jest.fn(),
      dispose: jest.fn(),
    };
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadEditorTabs, mainThread);
    const extHost = new ExtHostEditorTabs(rpcProtocol);
    const first = createTabDto('first', false);
    const second = createTabDto('second', false);
    extHost.$acceptEditorTabModel([
      {
        groupId: 1,
        viewColumn: 0,
        isActive: true,
        tabs: [first, second],
      },
    ]);
    const group = extHost.tabGroups.all[0];
    const movedTab = group.tabs[0];

    extHost.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_MOVE,
      groupId: 1,
      index: 1,
      oldIndex: 0,
      tabDto: { ...first, isPinned: true },
    });

    expect(group.tabs.map((tab) => tab.label)).toEqual(['second', 'first']);
    expect(group.tabs[1]).toBe(movedTab);
    expect(movedTab.isPinned).toBe(true);
  });
});

function createTabDto(id: string, isPinned: boolean): IEditorTabDto {
  return {
    id,
    label: id,
    input: {
      kind: TabInputKind.TextInput,
      uri: Uri.file(`/${id}.ts`),
    },
    isActive: id === 'first',
    isPinned,
    isPreview: false,
    isDirty: false,
  };
}
