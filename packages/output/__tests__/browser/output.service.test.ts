import { Injector, Injectable } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ThemeModule } from '@ali/ide-theme/lib/browser/';
import { ILoggerManagerClient, Uri } from '@ali/ide-core-common';
import { OutputModule } from '../../src/browser/index';
import { OutputService } from '../../src/browser/output.service';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';

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

  let injector: Injector;
  let outputService: OutputService;

  injector = createBrowserInjector([
    OutputModule as any,
    ThemeModule,
  ]);
  injector.addProviders({
    token: ILoggerManagerClient,
    useClass: MockLoggerManagerClient,
  }, {
    token: IMainLayoutService,
    useClass : MockMainLayoutService,
  });

  outputService = injector.get(OutputService);

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
