import { Injector, Injectable } from '@opensumi/di';
import { Uri, URI, MarkerManager, Emitter } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService, IEditorGroup } from '@opensumi/ide-editor';
import { EditorGroupCloseEvent, IResource } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { IThemeService } from '@opensumi/ide-theme';

import { MarkerSeverity } from '../../../core-common/src/types/markers/markers';
import { MarkerService } from '../../src/browser/markers-service';

@Injectable()
class MockMainLayoutService {
  getTabbarHandler() {
    return {
      isVisible: false,
      activate() {},
    };
  }
}

@Injectable()
class MockEditorService {
  open() {}
}

@Injectable()
class MockThemeService {
  onThemeChange = jest.fn();
}

const fakeUri = new URI(Uri.file('/test/workspace/fakeResource.ts'));
const fakeResource = {
  name: 'fakeResource',
  uri: fakeUri,
  icon: 'fakeResourceIcon',
};

const mockLoadingEmitter = new Emitter<IResource>();
const fakeEditorGroup: IEditorGroup = {
  index: 1,
  name: 'fakeEditorGroup',
  currentEditor: null,
  codeEditor: (() => {}) as any,
  diffEditor: (() => {}) as any,
  currentOrPreviousFocusedEditor: null,
  currentFocusedEditor: null,
  resources: [],
  currentResource: null,
  currentOpenType: null,
  open: (() => {}) as any,
  pin: (() => {}) as any,
  close: (() => {}) as any,
  getState: (() => {}) as any,
  restoreState: (() => {}) as any,
  saveAll: (() => {}) as any,
  closeAll: (() => {}) as any,
  onDidEditorGroupContentLoading: mockLoadingEmitter.event,
  resourceStatus: new Map(),
  saveCurrent: (() => {}) as any,
  saveResource: (() => {}) as any,
};

fakeEditorGroup.resources = [fakeResource];

const fakeCloseEvent = new EditorGroupCloseEvent({
  group: fakeEditorGroup,
  resource: fakeResource,
});

const fakeMarker = {
  code: 'code1',
  severity: MarkerSeverity.Error,
  message: 'error message 1',
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 2,
  endColumn: 2,
};

const injector: Injector = createBrowserInjector(
  [],
  new Injector([
    {
      token: IMainLayoutService,
      useValue: MockMainLayoutService,
    },
    {
      token: WorkbenchEditorService,
      useClass: MockEditorService,
    },
    {
      token: IThemeService,
      useClass: MockThemeService,
    },
    {
      token: MarkerManager,
      useClass: MarkerManager,
    },
    MarkerService,
  ]),
);

const markerService = injector.get(MarkerService);
const manager = markerService.getManager();

describe('markers.service.ts', () => {
  beforeEach(() => {
    manager.updateMarkers('test', fakeUri.toString(), [fakeMarker]);
  });

  it('test update markers', () => {
    manager.updateMarkers('test', fakeUri.toString(), [fakeMarker]);
    expect(manager.getResources()).toEqual(['file:///test/workspace/fakeResource.ts']);
  });

  it('test remove markers', () => {
    markerService.onEditorGroupClose(fakeCloseEvent);
    expect(manager.getResources()).toEqual([]);
  });
});
