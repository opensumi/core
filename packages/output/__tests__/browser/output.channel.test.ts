import { Injector, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { IEventBus, EventBusImpl } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { ContentChangeEvent, ContentChangeType } from '@opensumi/ide-output/lib/common';

import { OutputPreferences } from '../../src/browser/output-preference';
import { OutputChannel } from '../../src/browser/output.channel';

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
  get: (k) => preferences.get(k),
  set: (k, v) => {
    preferences.set(k, v);
  },
  onPreferenceChanged: (listener) => ({
    dispose: () => {},
  }),
};

describe('OutputChannel Test Sutes', () => {
  const injector: Injector = createBrowserInjector(
    [],
    new Injector([
      {
        token: IMainLayoutService,
        useClass: MockMainLayoutService,
      },
      {
        token: PreferenceService,
        useValue: mockedPreferenceService,
      },
      {
        token: IEditorDocumentModelService,
        useClass: EditorDocumentModelServiceImpl,
      },
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
      {
        token: OutputPreferences,
        useValue: {
          'output.logWhenNoPanel': true,
        },
      },
    ]),
  );

  const outputChannel = injector.get(OutputChannel, ['test channel']);
  const eventBus: IEventBus = injector.get(IEventBus);

  it('have corrent channel name', () => {
    expect(outputChannel.name).toBe('test channel');
  });

  it('can append text via outputChannel', () => {
    outputChannel.append('text');
    const disposer = eventBus.once(ContentChangeEvent, (e) => {
      if (e.payload.changeType === ContentChangeType.append && e.payload.channelName === 'test channel') {
        expect(e.payload.value).toBe('text');
        disposer.dispose();
      }
    });
  });

  it('outputChannel#replace', () => {
    const outputChannel2 = injector.get(OutputChannel, ['test channel2']);
    outputChannel2.replace('test replace channel content');

    eventBus.once(ContentChangeEvent, (e) => {
      if (e.payload.changeType === ContentChangeType.append && e.payload.channelName === 'test channel2') {
        expect(e.payload.value).toBe('test replace channel content');
        expect(outputChannel2['outputLines'].length).toBe(1);
        expect(outputChannel2['outputLines'][0]).toBe('test replace channel content');
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
