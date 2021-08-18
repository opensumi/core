import { Injector, Injectable } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ILoggerManagerClient } from '@ali/ide-core-common';
import { OutputService } from '../../src/browser/output.service';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { PreferenceService } from '@ali/ide-core-browser';
import { OutputPreferences } from '../../src/browser/output-preference';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { MonacoService } from '@ali/ide-monaco';
import { MockedMonacoService } from '@ali/ide-monaco/__mocks__/monaco.service.mock';

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
