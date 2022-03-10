import { Injectable } from '@opensumi/di';
import {
  PreferenceSchemaProvider,
  IPreferenceSettingsService,
  ILoggerManagerClient,
  URI,
} from '@opensumi/ide-core-browser';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import {
  MockPreferenceSchemaProvider,
  MockPreferenceSettingsService,
} from '@opensumi/ide-core-browser/__mocks__/preference';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { SemanticTokenRegistryImpl } from '@opensumi/ide-theme/lib/browser/semantic-tokens-registry';
import { Color } from '@opensumi/ide-theme/lib/common';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import { IThemeService } from '../../';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { WorkbenchThemeService } from '../../src/browser/workbench.theme.service';


@Injectable()
class MockFileServiceClient {
  resolveContent(uri: string) {
    if (uri.indexOf('json') > -1) {
      return {
        content: `{
          "$schema": "vscode://schemas/color-theme",
          "name": "Dark Default Colors",
          "colors": {
            "editor.background": "#1E1E1E",
            "editor.foreground": "#D4D4D4",
            "editor.inactiveSelectionBackground": "#3A3D41",
            "editorIndentGuide.background": "#404040",
            "editorIndentGuide.activeBackground": "#707070",
            "editor.selectionHighlightBackground": "#ADD6FF26",
            "list.dropBackground": "#383B3D",
            "activityBarBadge.background": "#007ACC",
            "sideBarTitle.foreground": "#BBBBBB",
            "input.placeholderForeground": "#A6A6A6",
            "settings.textInputBackground": "#292929",
            "settings.numberInputBackground": "#292929",
            "menu.background": "#252526",
            "menu.foreground": "#CCCCCC",
            "statusBarItem.remoteForeground": "#FFF",
            "statusBarItem.remoteBackground": "#16825D"
          },
          "semanticTokenColors": {
            "comment:java": "#ff004f"
          },
          "semanticHighlighting": true
        }`,
      };
    }
    return {
      content: `<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>name</key>
          <string>Dracula</string>
          <key>settings</key>
          <array>
            <dict>
              <key>settings</key>
              <dict>
                <key>background</key>
                <string>#282a36</string>
                <key>caret</key>
                <string>#f8f8f0</string>
                <key>foreground</key>
                <string>#f8f8f2</string>
                <key>invisibles</key>
                <string>#3B3A32</string>
                <key>lineHighlight</key>
                <string>#44475a</string>
                <key>selection</key>
                <string>#44475a</string>
                <key>findHighlight</key>
                <string>#effb7b</string>
                <key>findHighlightForeground</key>
                <string>#000000</string>
                <key>selectionBorder</key>
                <string>#222218</string>
                <key>activeGuide</key>
                <string>#9D550FB0</string>
                <key>bracketsForeground</key>
                <string>#F8F8F2A5</string>
                <key>bracketsOptions</key>
                <string>underline</string>
                <key>bracketContentsForeground</key>
                <string>#F8F8F2A5</string>
                <key>bracketContentsOptions</key>
                <string>underline</string>
                <key>tagsOptions</key>
                <string>stippled_underline</string>
              </dict>
            </dict>
          </array>
        </dict>
        </plist>`,
    };
  }
}

describe('color theme service test', () => {
  let service: IThemeService;
  let injector: MockInjector;
  beforeEach(() => {
    injector = createBrowserInjector([]);

    injector.addProviders(
      {
        token: IThemeService,
        useClass: WorkbenchThemeService,
      },
      {
        token: ISemanticTokenRegistry,
        useClass: SemanticTokenRegistryImpl,
      },
      {
        token: PreferenceSchemaProvider,
        useClass: MockPreferenceSchemaProvider,
      },
      {
        token: IPreferenceSettingsService,
        useClass: MockPreferenceSettingsService,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
    );
  });

  it('should be able to apply default theme', async (done) => {
    service = injector.get(IThemeService);
    const availableThemes = service.getAvailableThemeInfos();
    expect(availableThemes.length).toEqual(0);
    await service.applyTheme('ide-dark');
    expect(service.getCurrentThemeSync()).toBeDefined();
    expect(service.getCurrentThemeSync().themeData.id).toBe('Default Dark+');
    done();
  });

  it('should be able to register json theme', () => {
    service.registerThemes(
      [
        {
          id: 'test-theme',
          label: 'Dark Default Colors',
          uiTheme: 'vs',
          path: './test-relativa-path/theme.json',
        },
      ],
      new URI('file://base-ext-path'),
    );
    const availableThemes = service.getAvailableThemeInfos();
    expect(availableThemes.length).toEqual(1);
  });

  it('should be able to register textmate theme', () => {
    service.registerThemes(
      [
        {
          id: 'test-theme-plist',
          label: 'Dracula',
          uiTheme: 'vs',
          path: './test-relativa-path/theme.plist',
        },
      ],
      new URI('file://base-ext-path'),
    );
    const availableThemes = service.getAvailableThemeInfos();
    expect(availableThemes.length).toEqual(2);
  });

  it('should be able to toggle theme', async (done) => {
    expect(service.getCurrentThemeSync().themeData.name).toEqual('Dark+ (default dark)');
    await service.applyTheme('test-theme');
    expect(service.getCurrentThemeSync().themeData.name).toEqual('Dark Default Colors');
    await service.applyTheme('test-theme-plist');
    expect(service.getCurrentThemeSync().themeData.name).toEqual('Dracula');
    done();
  });

  it('should be able to get current worked theme', () => {
    const currentTheme = service.getCurrentThemeSync();
    expect(currentTheme).toBeDefined();
    expect(['light', 'dark', 'hc'].indexOf(currentTheme.type)).toBeGreaterThan(-1);
    const themeData = currentTheme.themeData;
    expect(Object.keys(themeData.colors).length).toBeGreaterThan(0);
    expect(themeData.encodedTokensColors).toBeDefined();
    expect(themeData.encodedTokensColors!.length).toEqual(0);
    expect(['vs', 'vs-dark', 'hc-black'].indexOf(themeData.base)).toBeGreaterThan(-1);
    expect(themeData.rules.length).toBeGreaterThan(0);
  });

  it('should check contribution before register color', () => {
    const currentTheme = service.getCurrentThemeSync();
    const illegalColorId = 'test-color-id';
    service.registerColor({
      // error id here
      id: illegalColorId,
      description: 'test',
      defaults: {
        light: 'errorForeground',
        dark: 'errorForeground',
        highContrast: 'errorForeground',
      },
    });
    expect(currentTheme.getColor(illegalColorId)).toBeUndefined();
  });

  it('should be able to register & get color', () => {
    const currentTheme = service.getCurrentThemeSync();
    const legalColorId = 'test.colorid';
    service.registerColor({
      id: legalColorId,
      description: 'test',
      defaults: {
        light: 'errorForeground',
        dark: 'errorForeground',
        highContrast: 'errorForeground',
      },
    });
    const testColor = currentTheme.getColor(legalColorId);
    expect(testColor).toBeDefined();
    expect(testColor!.toString()).toBeDefined();
    // console.log('test color to string: ', testColor!.toString());
  });

  it('css styler service test', () => {
    // @MMhunter
  });

  it('semanticTokenColors', async () => {
    await service.applyTheme('test-theme');
    const currentTheme = service.getCurrentThemeSync();
    expect(currentTheme).toBeDefined();
    expect(currentTheme.themeData['semanticHighlighting']).toBeTruthy();

    const tokenStyle = currentTheme.themeData['getTokenStyle']('comment', [], 'java');
    expect(tokenStyle).toBeDefined();
    expect(tokenStyle.foreground).toBeInstanceOf(Color);
    expect(Color.Format.CSS.formatHex(tokenStyle.foreground)).toBe('#ff004f');
    expect(tokenStyle.bold).toBeUndefined();
    expect(tokenStyle.underline).toBeUndefined();
    expect(tokenStyle.italic).toBeUndefined();

    const semanticTokenRule = currentTheme.themeData['semanticTokenRules'];
    expect(semanticTokenRule.length).toBe(1);
    expect(semanticTokenRule[0].selector.id).toBe('comment:java');
    expect(semanticTokenRule[0].style).toEqual(tokenStyle);
  });

  it('semanticTokenColorIndex', async (done) => {
    await service.applyTheme('test-theme');
    const currentTheme = service.getCurrentThemeSync();

    const colorIndex = currentTheme.themeData['getTokenColorIndex']();
    expect(colorIndex).toBeDefined();
    const idx = colorIndex.get('#ff004f');
    expect(idx).toBeDefined();
    expect(idx).toBe(7);

    const upperCaseColorIdx = colorIndex.get('#FF004F');
    expect(upperCaseColorIdx).toBeDefined();
    expect(upperCaseColorIdx).toBe(7);

    const undefinedIdx = colorIndex.get('#FAFAFA');
    expect(undefinedIdx).toBe(0);

    const added = colorIndex.add('#CCCCCC');
    expect(added).toBe(colorIndex.get('#CCCCCC'));

    const colorIdxArray = colorIndex.asArray();
    expect(colorIdxArray).toBeDefined();
    expect(colorIdxArray[0]).toBeUndefined();
    expect(Array.isArray(colorIdxArray)).toBeTruthy();
    expect(colorIdxArray[idx]).toBe('#FF004F');
    expect(colorIdxArray[added]).toBe('#CCCCCC');

    done();
  });
});
