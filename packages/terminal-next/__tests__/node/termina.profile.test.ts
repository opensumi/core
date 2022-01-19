import { Injector } from '@opensumi/di';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { ITerminalServiceClient, ITerminalNodeService } from '../../src/common';
import { TerminalNodePtyModule } from '../../src/node';
import { TerminalProfileServiceNode } from '../../src/node/terminal.profile.service';
import { IPtyProcess } from '../../src/common/pty';
import os from 'os';

describe('TerminalServiceClientImpl', () => {
  let injector: Injector;
  let terminalProfileService: TerminalProfileServiceNode;
  const mockClientId = 'a';
  let shellPath = '';

  if (os.platform() === 'win32') {
    shellPath = 'powershell';
  } else if (os.platform() === 'linux' || os.platform() === 'darwin') {
    shellPath = 'sh';
  }

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule], new Injector([]));
    terminalProfileService = injector.get(TerminalProfileServiceNode);
  });

  it('will get 0 profiles without any input data', async () => {
    const ps = await terminalProfileService.detectAvailableProfiles({
      autoDetect: false,
    });

    expect(ps.length === 0);
  });

  it('can parse preference configs', async () => {
    const ps = await terminalProfileService.detectAvailableProfiles({
      autoDetect: false,
      preference: {
        bash: {
          path: '/bin/bash',
          args: ['-l'],
        },
      },
    });

    expect(ps.length === 1);
    expect(ps[0].profileName === 'bash');
    expect(ps[0].args === ['-l']);
  });
  it('can resolve autoDetect profiles', async () => {
    const ps = await terminalProfileService.detectAvailableProfiles({
      autoDetect: true,
    });

    expect(ps.length > 0);
  });
});
