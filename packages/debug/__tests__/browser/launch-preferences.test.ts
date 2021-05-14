import { Injectable } from '@ali/common-di';
import { enableJSDOM } from '@ali/ide-core-browser/lib/mocks/jsdom';
const disableJSDOM = enableJSDOM();

import * as path from 'path';
import * as fs from 'fs-extra';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { PreferenceService, ClientAppConfigProvider, FileUri, Disposable, DisposableCollection, ILogger, ResourceProvider, PreferenceScope, injectPreferenceSchemaProvider, DefaultResourceProvider, ILoggerManagerClient } from '@ali/ide-core-browser';
import { AppConfig } from '@ali/ide-core-node';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IMessageService } from '@ali/ide-overlay';
import { IWorkspaceService } from '@ali/ide-workspace';
import { LaunchPreferencesContribution } from '../../src/browser/preferences/launch-preferences-contribution';
import { FolderPreferenceProvider } from '@ali/ide-preferences/lib/browser/folder-preference-provider';
import { LaunchFolderPreferenceProvider } from '../../src/browser/preferences/launch-folder-preference-provider';
import { injectPreferenceProviders, createPreferenceProviders } from '@ali/ide-preferences/lib/browser';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IFileServiceClient, FileServicePath, FileStat, IDiskFileProvider, IShadowFileProvider } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileSystemNodeOptions, FileService } from '@ali/ide-file-service/lib/node';
import { MockUserStorageResolver } from '@ali/ide-preferences/lib/common/mocks';
import { FileResourceResolver } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { WorkspacePreferences } from '@ali/ide-workspace/lib/browser/workspace-preferences';
import { DiskFileSystemProvider } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
disableJSDOM();

@Injectable()
export class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() {},
    };
  }
}

/**
 * launch配置项需要与VSCode中的配置项对齐
 * 见 https://github.com/akosyakov/vscode-launch/blob/master/src/test/extension.test.ts
 */
describe('Launch Preferences', () => {

  type ConfigMode = '.kaitian' | ['.kaitian'];

  const defaultLaunch = {
    'configurations': [],
    'compounds': [],
  };

  const validConfiguration = {
    'name': 'Launch Program',
    'program': '${file}',
    'request': 'launch',
    'type': 'node',
  };

  const validConfiguration2 = {
    'name': 'Launch Program 2',
    'program': '${file}',
    'request': 'launch',
    'type': 'node',
  };

  const bogusConfiguration = {};

  const validCompound = {
    'name': 'Compound',
    'configurations': [
      'Launch Program',
      'Launch Program 2',
    ],
  };

  const bogusCompound = {};

  const bogusCompound2 = {
    'name': 'Compound 2',
    'configurations': [
      'Foo',
      'Launch Program 2',
    ],
  };

  const validLaunch = {
    configurations: [validConfiguration, validConfiguration2],
    compounds: [validCompound],
  };

  testSuite({
    name: 'No Preferences',
    expectation: defaultLaunch,
  });

  testLaunchAndSettingsSuite({
    name: 'Empty With Version',
    launch: {
      'version': '0.2.0',
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [],
      'compounds': [],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Empty With Version And Configurations',
    launch: {
      'version': '0.2.0',
      'configurations': [],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [],
      'compounds': [],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Empty With Version And Compounds',
    launch: {
      'version': '0.2.0',
      'compounds': [],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [],
      'compounds': [],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Valid Conf',
    launch: {
      'version': '0.2.0',
      'configurations': [validConfiguration],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration],
      'compounds': [],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Bogus Conf',
    launch: {
      'version': '0.2.0',
      'configurations': [validConfiguration, bogusConfiguration],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration, bogusConfiguration],
      'compounds': [],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Completely Bogus Conf',
    launch: {
      'version': '0.2.0',
      'configurations': { 'valid': validConfiguration, 'bogus': bogusConfiguration },
    },
    expectation: {
      'version': '0.2.0',
      'configurations': { 'valid': validConfiguration, 'bogus': bogusConfiguration },
      'compounds': [],
    },
  });

  const arrayBogusLaunch = [
    'version', '0.2.0',
    'configurations', { 'valid': validConfiguration, 'bogus': bogusConfiguration },
  ];
  testSuite({
    name: 'Array Bogus Launch Configuration',
    launch: arrayBogusLaunch,
    expectation: {
      '0': 'version',
      '1': '0.2.0',
      '2': 'configurations',
      '3': { 'valid': validConfiguration, 'bogus': bogusConfiguration },
      'compounds': [],
      'configurations': [],
    },
    inspectExpectation: {
      preferenceName: 'launch',
      defaultValue: defaultLaunch,
      workspaceValue: {
        '0': 'version',
        '1': '0.2.0',
        '2': 'configurations',
        '3': { 'valid': validConfiguration, 'bogus': bogusConfiguration },
      },
    },
  });
  testSuite({
    name: 'Array Bogus Settings Configuration',
    settings: {
      launch: arrayBogusLaunch,
    },
    expectation: {
      '0': 'version',
      '1': '0.2.0',
      '2': 'configurations',
      '3': { 'valid': validConfiguration, 'bogus': bogusConfiguration },
      'compounds': [],
      'configurations': [],
    },
    inspectExpectation: {
      preferenceName: 'launch',
      defaultValue: defaultLaunch,
      workspaceValue: arrayBogusLaunch,
    },
  });

  testSuite({
    name: 'Null Bogus Launch Configuration',
    launch: null,
    expectation: {
      'compounds': [],
      'configurations': [],
    },
  });
  testSuite({
    name: 'Null Bogus Settings Configuration',
    settings: {
      'launch': null,
    },
    expectation: {},
  });

  testLaunchAndSettingsSuite({
    name: 'Valid Compound',
    launch: {
      'version': '0.2.0',
      'configurations': [validConfiguration, validConfiguration2],
      'compounds': [validCompound],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration, validConfiguration2],
      'compounds': [validCompound],
    },
  });

  testLaunchAndSettingsSuite({
    name: 'Valid And Bogus',
    launch: {
      'version': '0.2.0',
      'configurations': [validConfiguration, validConfiguration2, bogusConfiguration],
      'compounds': [validCompound, bogusCompound, bogusCompound2],
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration, validConfiguration2, bogusConfiguration],
      'compounds': [validCompound, bogusCompound, bogusCompound2],
    },
  });

  testSuite({
    name: 'Mixed',
    launch: {
      'version': '0.2.0',
      'configurations': [validConfiguration, bogusConfiguration],
      'compounds': [bogusCompound, bogusCompound2],
    },
    settings: {
      launch: {
        'version': '0.2.0',
        'configurations': [validConfiguration2],
        'compounds': [validCompound],
      },
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration, bogusConfiguration],
      'compounds': [bogusCompound, bogusCompound2],
    },
  });

  testSuite({
    name: 'Mixed Launch Without Configurations',
    launch: {
      'version': '0.2.0',
      'compounds': [bogusCompound, bogusCompound2],
    },
    settings: {
      launch: {
        'version': '0.2.0',
        'configurations': [validConfiguration2],
        'compounds': [validCompound],
      },
    },
    expectation: {
      'version': '0.2.0',
      'configurations': [validConfiguration2],
      'compounds': [bogusCompound, bogusCompound2],
    },
    inspectExpectation: {
      preferenceName: 'launch',
      defaultValue: defaultLaunch,
      workspaceValue: {
        'version': '0.2.0',
        'configurations': [validConfiguration2],
        'compounds': [bogusCompound, bogusCompound2],
      },
    },
  });

  function testLaunchAndSettingsSuite({
    name, expectation, launch, only, configMode,
  }: {
    name: string,
    expectation: any,
    launch?: any,
    only?: boolean,
    configMode?: ConfigMode,
  }): void {
    testSuite({
      name: name + ' Launch Configuration',
      launch,
      expectation,
      only,
      configMode,
    });
    testSuite({
      name: name + ' Settings Configuration',
      settings: {
        'launch': launch,
      },
      expectation,
      only,
      configMode,
    });
  }

  function testSuite(options: {
    name: string,
    expectation: any,
    inspectExpectation?: any,
    launch?: any,
    settings?: any,
    only?: boolean,
    configMode?: ConfigMode,
  }): void {

    describe(options.name, () => {

      if (options.configMode) {
        testConfigSuite(options as any);
      } else {

        testConfigSuite({
          ...options,
          configMode: '.kaitian',
        });
      }

    });

  }

  function testConfigSuite({
    configMode, expectation, inspectExpectation, settings, launch, only,
  }: {
    configMode: ConfigMode
    expectation: any,
    inspectExpectation?: any,
    launch?: any,
    settings?: any,
    only?: boolean,
  }): void {

    describe(JSON.stringify(configMode, undefined, 2), () => {

      const configPaths = Array.isArray(configMode) ? configMode : [configMode];

      const rootPath = path.resolve(__dirname, '..', '..', '..', 'launch-preference-test-temp');
      const rootUri = FileUri.create(rootPath).toString();

      let injector: MockInjector;

      let preferences: PreferenceService;

      const toTearDown = new DisposableCollection();

      const initializeInjector = async () => {
        toTearDown.push(Disposable.create(enableJSDOM()));
        ClientAppConfigProvider.set({
          applicationName: 'test',
          uriScheme: 'test',
        });

        fs.removeSync(rootPath);
        fs.ensureDirSync(rootPath);
        toTearDown.push(Disposable.create(() => fs.removeSync(rootPath)));

        if (settings) {
          for (const configPath of configPaths) {
            const settingsPath = path.resolve(rootPath, configPath, 'settings.json');
            fs.ensureFileSync(settingsPath);
            fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf-8');
          }
        }
        if (launch) {
          for (const configPath of configPaths) {
            const launchPath = path.resolve(rootPath, configPath, 'launch.json');
            fs.ensureFileSync(launchPath);
            fs.writeFileSync(launchPath, JSON.stringify(launch), 'utf-8');
          }
        }

        injector = createBrowserInjector([]);

        // 注册额外的Folder SectionName，如‘launch’
        injector.addProviders(LaunchPreferencesContribution);

        injector.addProviders(
          {
            token: ILogger,
            useValue: {},
          },
          {
            token: IMessageService,
            useValue: {},
          },
          {
            token: AppConfig,
            useValue: {},
          },
          {
            token: 'FileServiceOptions',
            useValue: FileSystemNodeOptions.DEFAULT,
          },
          {
            token: IDiskFileProvider,
            useClass: DiskFileSystemProvider,
          },
          {
            token: IShadowFileProvider,
            useValue: {},
          },
          {
            token: FileServicePath,
            useClass: FileService,
          },
          {
            token: IFileServiceClient,
            useClass: FileServiceClient,
          },
          {
            token: ILoggerManagerClient,
            useClass: MockLoggerManagerClient,
          },
          {
            token: ResourceProvider,
            useFactory: () => {
              return (uri) => {
                return injector.get(DefaultResourceProvider).get(uri);
              };
            },
          },
          MockUserStorageResolver,
          FileResourceResolver,
        );
        // TODO: 为了mock实例提前获取
        injector.get(FileServicePath);
        // 替换文件监听函数实现
        injector.mock(FileServicePath, 'watchFileChanges', () => { });
        const fsClient: IFileServiceClient = injector.get(IFileServiceClient);
        const diskProvider = injector.get(IDiskFileProvider);
        const shadowProvider = injector.get(IShadowFileProvider);
        fsClient.registerProvider('file', diskProvider);
        fsClient.registerProvider('debug', shadowProvider);

        injectPreferenceSchemaProvider(injector);

        injector.addProviders({
          token: IWorkspaceService,
          useClass: WorkspaceService,
        }, {
          token: WorkspacePreferences,
          useValue: {
            onPreferenceChanged: () => {},
          },
        });

        // TODO: 为了mock实例提前获取
        injector.get(IWorkspaceService);

        injector.mock(IWorkspaceService, 'getDefaultWorkspacePath', () => rootUri);
        injector.mock(IWorkspaceService, 'roots', [{
          uri: rootUri,
          lastModification: 0,
          isDirectory: true,
        }] as FileStat[]);
        injector.mock(IWorkspaceService, 'tryGetRoots', () => [{
          uri: rootUri,
          lastModification: 0,
          isDirectory: true,
        }] as FileStat[]);
        injector.mock(IWorkspaceService, 'workspace', {
          uri: rootUri,
          lastModification: 0,
          isDirectory: true,
        } as FileStat);

        // 引入USER/WORKSPACE?FOLDER配置
        injector.addProviders(
          ...createPreferenceProviders(),
        );
        injectPreferenceProviders(injector);

        // 注册launch.json配置文件定义
        injector.addProviders({
          token: FolderPreferenceProvider,
          useClass: LaunchFolderPreferenceProvider,
          dropdownForTag: true,
          tag: 'launch',
        });

        const impl = injector.get(PreferenceService);
        toTearDown.push(impl);

        preferences = impl;
        toTearDown.push(Disposable.create(() => preferences = undefined!));

        await preferences.ready;
        await injector.get(IWorkspaceService).roots;
      };

      beforeEach(() => {
        return initializeInjector();
      });

      afterEach(() => toTearDown.dispose());

      const settingsLaunch = settings ? settings.launch : undefined;

      it('get from default', () => {
        const config = preferences.get('launch');
        expect(JSON.parse(JSON.stringify(config))).toEqual(expectation);
      });

      it('get from undefined', () => {
        const config = preferences.get('launch', undefined, undefined);
        expect(JSON.parse(JSON.stringify(config))).toEqual(expectation);
      });

      it('get from rootUri', () => {
        const config = preferences.get('launch', undefined, rootUri);
        expect(JSON.parse(JSON.stringify(config))).toEqual(expectation);
      });

      it('inspect in undefined', () => {
        const inspect = preferences.inspect('launch');
        let expected = inspectExpectation;
        if (!expected) {
          expected = {
            preferenceName: 'launch',
            defaultValue: defaultLaunch,
          };
          const workspaceValue = launch || settingsLaunch;
          if (workspaceValue !== undefined) {
            Object.assign(expected, { workspaceValue });
          }
        }
        expect(JSON.parse(JSON.stringify(inspect))).toEqual(expected);
      });

      it('inspect in rootUri', () => {
        const inspect = preferences.inspect('launch', rootUri);
        const expected = {
          preferenceName: 'launch',
          defaultValue: defaultLaunch,
        };
        if (inspectExpectation) {
          Object.assign(expected, {
            workspaceValue: inspectExpectation.workspaceValue,
            workspaceFolderValue: inspectExpectation.workspaceValue,
          });
        } else {
          const value = launch || settingsLaunch;
          if (value !== undefined) {
            Object.assign(expected, {
              workspaceValue: value,
              workspaceFolderValue: value,
            });
          }
        }
        expect(JSON.parse(JSON.stringify(inspect))).toEqual(expected);
      });

      it('update launch', async (done) => {
        await preferences.set('launch', validLaunch);

        const inspect = preferences.inspect('launch');
        const actual = inspect && inspect.workspaceValue;
        const expected = settingsLaunch && !Array.isArray(settingsLaunch) ? { ...settingsLaunch, ...validLaunch } : validLaunch;
        expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
        done();
      });

      it('update launch Global', async () => {
        try {
          await preferences.set('launch', validLaunch, PreferenceScope.User);
        } catch (e) {
          expect(e.message).toBe('Unable to write to User Settings because launch does not support for global scope.');
        }
      });

      it('update launch Workspace', async () => {
        await preferences.set('launch', validLaunch, PreferenceScope.Workspace);

        const inspect = preferences.inspect('launch');
        const actual = inspect && inspect.workspaceValue;
        const expected = settingsLaunch && !Array.isArray(settingsLaunch) ? { ...settingsLaunch, ...validLaunch } : validLaunch;
        expect(actual).toEqual(expected);
      });

      it('update launch WorkspaceFolder', async () => {
        try {
          await preferences.set('launch', validLaunch, PreferenceScope.Folder);
        } catch (e) {
          expect(e.message).toBe('Unable to write to Folder Settings because no resource is provided.');
        }
      });

      it('update launch WorkspaceFolder with resource', async () => {
        await preferences.set('launch', validLaunch, PreferenceScope.Folder, rootUri);

        const inspect = preferences.inspect('launch');
        const actual = inspect && inspect.workspaceValue;
        const expected = settingsLaunch && !Array.isArray(settingsLaunch) ? { ...settingsLaunch, ...validLaunch } : validLaunch;
        expect(actual).toEqual(expected);
      });

      if ((launch && !Array.isArray(launch)) || (settingsLaunch && !Array.isArray(settingsLaunch))) {
        it('update launch.configurations', async () => {
          await preferences.set('launch.configurations', [validConfiguration, validConfiguration2]);

          const inspect = preferences.inspect('launch');
          const actual = inspect && inspect.workspaceValue && (inspect.workspaceValue as any).configurations;
          expect(actual).toEqual([validConfiguration, validConfiguration2]);
        });
      }

      it('delete launch', async () => {
        await preferences.set('launch', undefined);
        const actual = preferences.inspect('launch');

        let expected;
        if (configPaths[0]) {
          expected = launch;
          if (Array.isArray(expected)) {
            expected = { ...expected };
          }
          if (expected && !expected.configurations && settingsLaunch && settingsLaunch.configurations !== undefined) {
            expected.configurations = settingsLaunch.configurations;
          }
        }
        expected = expected || settingsLaunch;
        expect(actual && actual.workspaceValue).toEqual(expected);
      });

      if ((launch && !Array.isArray(launch)) || (settingsLaunch && !Array.isArray(settingsLaunch))) {
        it('delete launch.configurations', async () => {
          await preferences.set('launch.configurations', undefined);

          const actual = preferences.inspect('launch');
          const actualWorkspaceValue = actual && actual.workspaceValue;

          let expected;
          if (launch) {
            expected = { ...launch };
            delete expected.configurations;
          }
          if (settings) {
            let _settingsLaunch;
            if (typeof settingsLaunch === 'object' && !Array.isArray(settings.launch) && settings.launch !== null) {
              _settingsLaunch = settingsLaunch;
            } else {
              _settingsLaunch = expectation;
            }
            if (expected) {
              if (_settingsLaunch.configurations !== undefined) {
                expected.configurations = _settingsLaunch.configurations;
              }
            } else {
              expected = _settingsLaunch;
            }
          }
          expect(actualWorkspaceValue).toEqual(expected);
        });
      }

    });

  }

});
