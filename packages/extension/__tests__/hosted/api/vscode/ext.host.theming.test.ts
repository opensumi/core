import { Emitter } from '@opensumi/ide-core-common';
import { MainThreadTheming } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.theming';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { ColorThemeKind } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { ExtHostTheming } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.theming';
import { IThemeService, ThemeType } from '@opensumi/ide-theme';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { createMockPairRPCProtocol } from '../../../../__mocks__/initRPCProtocol';

const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();

let extHost: ExtHostTheming;
let mainThread: MainThreadTheming;

describe('vscode extHostTheming Test', () => {
  const injector = createBrowserInjector([]);
  const themeChangeEmitter = new Emitter<{ type: ThemeType }>();
  const mockThemeService = {
    onThemeChange: themeChangeEmitter.event,
    getCurrentThemeSync() {
      return { type: 'light' };
    },
  };
  injector.addProviders({
    token: IThemeService,
    useValue: mockThemeService,
  });
  extHost = new ExtHostTheming(rpcProtocolExt);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTheming, extHost);

  mainThread = rpcProtocolMain.set(
    MainThreadAPIIdentifier.MainThreadLanguages,
    injector.get(MainThreadTheming, [rpcProtocolMain]),
  );

  afterAll(() => {
    mainThread.dispose();
  });

  it('init correct active theme when extension ready', (done) => {
    expect(extHost.activeColorTheme.kind).toEqual(ColorThemeKind.Light);
    done();
  });

  it('ext host vscode theming test', (done) => {
    extHost.onDidChangeActiveColorTheme((e) => {
      expect(e.kind).toEqual(ColorThemeKind.HighContrast);
      done();
    });
    themeChangeEmitter.fire({ type: 'hcDark' });
  });
});
