import { Injector, Injectable } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ThemeModule } from '@ali/ide-theme/lib/browser/';
import { ILoggerManagerClient, Uri } from '@ali/ide-core-common';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';
import { Terminal2Module } from '../../src/browser/index';
import { ITerminalClient, TerminalInfo, ITerminalServicePath, ITerminalServiceClient } from '../../src/common';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';

jest.mock('xterm', () => {
  class Terminal {
    focus() {}
    fit() {}
    attach() {}
    on() {}
    open() {}
    webLinksInit() {}

    static applyAddon() {}
  }

  return {
    Terminal,
  };
});

@Injectable()
class MockTerminalNodeService {
  createArgs: any[];
  resizeArgs: any[];
  onMessageArgs: any[];

  create = async (...args) => {
    this.createArgs = args;

    return {
      pid: 1000,
      name: 'shell',
    };
  }

  resize = (...args) => {
    this.resizeArgs = args;
  }

  getProcessId  = (id: string) => {
    return id;
  }

  disposeById() {}

  onMessage = (...args) => {
    this.onMessageArgs = args;
  }
}

@Injectable()
class MockWSChanneHandler {
  clientId = '1';
}

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

describe('terminal.service.ts', () => {

  let injector: Injector;
  let terminalClient: ITerminalClient;

  injector = createBrowserInjector([
    Terminal2Module as any,
    ThemeModule,
  ]);
  injector.addProviders({
    token: ITerminalServicePath,
    useClass: MockTerminalNodeService,
  },
  {
    token: IWSChanneHandler,
    useClass: MockWSChanneHandler,
  }, {
    token: ILoggerManagerClient,
    useClass: MockLoggerManagerClient,
  }, {
    token: IMainLayoutService,
    useClass : MockMainLayoutService,
  });

  terminalClient = injector.get(ITerminalClient);
  const mockTerminalNodeService: MockTerminalNodeService = injector.get(ITerminalServicePath);

  test('onDidChangeActiveTerminal', () => {
    const terminalId: string = '1';
    let catchTerminalId: string = '';
    let disposer;

    disposer = terminalClient.onDidChangeActiveTerminal((id) => {
        catchTerminalId = id;
      });
    (terminalClient  as any).changeActiveTerminalEvent.fire(terminalId);

    expect(catchTerminalId).toEqual(terminalId);
    disposer.dispose();
  });

  test('onDidCloseTerminal', () => {
    const terminalId: string = '1';
    let catchTerminalId: string = '';
    let disposer;

    disposer = terminalClient.onDidCloseTerminal((id) => {
        catchTerminalId = id;
      });
    (terminalClient  as any).closeTerminalEvent.fire(terminalId);

    expect(catchTerminalId).toEqual(terminalId);
    disposer.dispose();
  });

  test('onDidOpenTerminal', () => {
    const terminalInfo: TerminalInfo = {
      id: '1',
      name: 'test',
      isActive: false,
    };
    let catchTerminalInfo: any = {};
    let disposer;

    disposer = terminalClient.onDidOpenTerminal((info: TerminalInfo) => {
      catchTerminalInfo = info;
      });
    (terminalClient  as any).openTerminalEvent.fire(terminalInfo);

    expect(catchTerminalInfo).toEqual(terminalInfo);
    disposer.dispose();
  });

  test('setWrapEl', () => {
    const el = document.createElement('div');
    el.id = 'terminal';

    terminalClient.setWrapEl(el);

    expect((terminalClient as any).wrapEl.id).toEqual(el.id);
  });

  test('setWrapEl', () => {
    const el = document.createElement('div');
    el.id = 'terminal';

    terminalClient.setWrapEl(el);

    expect((terminalClient as any).wrapEl.id).toEqual(el.id);
  });

  test('createTerminal', async () => {
    const terminal = await terminalClient.createTerminal({}, '1');

    expect(terminal.id).toEqual('1|1');
  });

  test('sendText', async () => {
    const terminal = await terminalClient.createTerminal({}, '2');

    terminal.serviceInitPromise = null;
    terminalClient.sendText('1|2', '22');

    expect(mockTerminalNodeService.onMessageArgs[0]).toEqual('1|2');
    expect(mockTerminalNodeService.onMessageArgs[1].trim()).toEqual('22');
  });

  test('showTerm', async () => {
    const terminal = await terminalClient.createTerminal({}, '3');

    terminalClient.showTerm('1|3');

    expect(terminal.isActive).toEqual(true);
  });

  test('hideTerm', async () => {
    const terminal = await terminalClient.createTerminal({}, '4');

    terminalClient.hideTerm('1|4');

    expect(terminal.isActive).toEqual(false);
  });

  test('removeTerm', async () => {
    const terminal = await terminalClient.createTerminal({}, '5');

    terminalClient.removeTerm('1|5');

    expect(terminalClient.getTerminal('1|5')).toEqual(undefined);
  });
});
