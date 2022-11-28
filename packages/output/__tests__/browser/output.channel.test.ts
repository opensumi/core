import { Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser/src/preferences';
import { IEventBus, EventBusImpl } from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import {
  EmptyDocCacheImpl,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/src/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { ContentChangeEvent, ContentChangeType } from '@opensumi/ide-output';

import { MockWalkThroughSnippetSchemeDocumentProvider } from '../../../file-scheme/__mocks__/browser/file-doc';
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
  const injector = createBrowserInjector([]);
  injector.overrideProviders(
    ...[
      {
        token: IMainLayoutService,
        useClass: MockMainLayoutService,
      },
      {
        token: PreferenceService,
        useValue: mockedPreferenceService,
      },
      {
        token: IEditorDocumentModelContentRegistry,
        useClass: EditorDocumentModelContentRegistryImpl,
      },
      {
        token: IHashCalculateService,
        useClass: HashCalculateServiceImpl,
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
      {
        token: IDocPersistentCacheProvider,
        useClass: EmptyDocCacheImpl,
      },
    ],
  );

  const outputChannel = injector.get(OutputChannel, ['test channel']);
  const eventBus: IEventBus = injector.get(IEventBus);
  const documentRegistry = injector.get<IEditorDocumentModelContentRegistry>(IEditorDocumentModelContentRegistry);
  documentRegistry.registerEditorDocumentModelContentProvider(
    injector.get(MockWalkThroughSnippetSchemeDocumentProvider),
  );

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
