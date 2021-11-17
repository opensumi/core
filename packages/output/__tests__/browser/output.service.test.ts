import { Injector, Injectable } from '@ide-framework/common-di';
import { createBrowserInjector } from '@ide-framework/ide-dev-tool/src/injector-helper';
import { ILoggerManagerClient } from '@ide-framework/ide-core-common';
import { OutputService } from '../../src/browser/output.service';
import { IMainLayoutService } from '@ide-framework/ide-main-layout/lib/common';
import { PreferenceService } from '@ide-framework/ide-core-browser';
import { OutputPreferences } from '../../src/browser/output-preference';
import { IWorkspaceService } from '@ide-framework/ide-workspace';
import { MockWorkspaceService } from '@ide-framework/ide-workspace/lib/common/mocks';
import { IEditorDocumentModelService } from '@ide-framework/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@ide-framework/ide-editor/lib/browser/doc-model/main';
import { MonacoService } from '@ide-framework/ide-monaco';
import { MockedMonacoService } from '@ide-framework/ide-monaco/__mocks__/monaco.service.mock';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() {},
      debug() {},
      error() {},
    };
  }
}

@Injectable()
class MockMainLayoutService {
  getTabbarHandler() {
    return {
      isVisible: false,
      activate() {},
    };
  }

}

const preferences: Map<string, any> = new Map();

const mockedPreferenceService: any = {
  get: (k) => {
    return preferences.get(k);
  },
  set: (k, v) => {
    preferences.set(k, v);
  },
  onPreferenceChanged: (listener) => {
    //
    return {
      dispose: () => {},
    };
  },
};

describe('Output.service.ts', () => {
  // let mockPreferenceVal = false;
  let outputService: OutputService;

  const injector: Injector = createBrowserInjector([], new Injector([
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    }, {
      token: IMainLayoutService,
      useClass : MockMainLayoutService,
    }, {
      token: PreferenceService,
      useValue: mockedPreferenceService,
    }, {
      token: MonacoService,
      useClass: MockedMonacoService,
    },
    {
      token: OutputService,
      useClass: OutputService,
    },
    {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    }, {
      token: OutputPreferences,
      useValue: {
        'output.logWhenNoPanel': true,
      },
    },
  ]));

  beforeAll(async () => {
    const monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
    outputService = injector.get(OutputService);
  });

  test('getChannel', () => {
    const output = outputService.getChannel('1');
    expect(output!.name).toEqual('1');
    outputService.deleteChannel('1');
  });

  test('deleteChannel', () => {
    const origLength = outputService.getChannels().length;
    outputService.getChannel('1');
    outputService.deleteChannel('1');
    expect(outputService.getChannels().length).toEqual(origLength);
  });

  test('getChannels', () => {
    const origLength = outputService.getChannels().length;
    outputService.getChannel('1');
    outputService.deleteChannel('1');
    expect(outputService.getChannels().length).toEqual(origLength);
  });

});
