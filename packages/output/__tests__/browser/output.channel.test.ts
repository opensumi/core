import { Injector, Injectable } from '@ide-framework/common-di';
import { createBrowserInjector } from '@ide-framework/ide-dev-tool/src/injector-helper';
import { ILoggerManagerClient, IEventBus, EventBusImpl } from '@ide-framework/ide-core-common';
import { OutputChannel } from '../../src/browser/output.channel';
import { IMainLayoutService } from '@ide-framework/ide-main-layout/lib/common';
import { PreferenceService } from '@ide-framework/ide-core-browser';
import { OutputPreferences } from '../../src/browser/output-preference';
import { IEditorDocumentModelService } from '@ide-framework/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@ide-framework/ide-editor/lib/browser/doc-model/main';
import { ContentChangeEvent, ContentChangeType } from '@ide-framework/ide-output/lib/common';

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
    return {
      dispose: () => {},
    };
  },
};

describe('OutputChannel Test Sutes', () => {
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
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    }, {
      token: IEventBus,
      useClass: EventBusImpl,
    }, {
      token: OutputPreferences,
      useValue: {
        'output.logWhenNoPanel': true,
      },
    },
  ]));

  const outputChannel = injector.get(OutputChannel, ['test channel']);
  const eventBus: IEventBus = injector.get(IEventBus);

  it('have corrent channel name', () => {
    expect(outputChannel.name).toBe('test channel');
  });

  it('can append text via outputChannel', () => {
    outputChannel.append('text');
    eventBus.once(ContentChangeEvent, (e) => {
      if (e.payload.changeType === ContentChangeType.append) {
        expect(e.payload.channelName).toBe('test channel');
        expect(e.payload.value).toBe('text');
      }
    });
  });

  it('can appendLine via outputChannel', () => {
    outputChannel.appendLine('text line');
    eventBus.once(ContentChangeEvent, (e) => {
      if (e.payload.changeType === ContentChangeType.appendLine) {
        expect(e.payload.channelName).toBe('test channel');
        expect(e.payload.value).toBe('text line');
      }
    });
  });

  it('can setVisibility', () => {
    outputChannel.setVisibility(false);
    expect(outputChannel.isVisible).toBeFalsy();
    outputChannel.setVisibility(true);
    expect(outputChannel.isVisible).toBeTruthy();
  });
});
