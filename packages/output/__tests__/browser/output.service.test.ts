import { Injector, Injectable } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ILoggerManagerClient, Event } from '@ali/ide-core-common';
import { OutputService } from '../../src/browser/output.service';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { PreferenceService } from '@ali/ide-core-browser';
import { OutputPreferences } from '../../src/browser/output-preference';
import { OutputModule } from '../../src/browser';

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

describe('Output.service.ts', () => {
  // let mockPreferenceVal = false;

  const injector: Injector = createBrowserInjector([OutputModule], new Injector([
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    }, {
      token: IMainLayoutService,
      useClass : MockMainLayoutService,
    }, {
      token: PreferenceService,
      useValue: {
        onPreferenceChanged: Event.None,
      },
    }, {
      token: OutputPreferences,
      useValue: {
        'output.logWhenNoPanel': true,
      },
    },
  ]));

  const outputService = injector.get(OutputService);

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
