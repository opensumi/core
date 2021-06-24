import { Injectable } from '@ali/common-di';
import { enableJSDOM } from '@ali/ide-core-browser/lib/mocks/jsdom';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { PreferenceService, ClientAppConfigProvider, FileUri, Disposable, DisposableCollection, ILogger, PreferenceScope, ILoggerManagerClient, URI } from '@ali/ide-core-browser';
import { AppConfig } from '@ali/ide-core-node';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IMessageService } from '@ali/ide-overlay';
import { IWorkspaceService } from '@ali/ide-workspace';
import { PreferencesModule } from '@ali/ide-preferences/lib/browser';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IFileServiceClient, IDiskFileProvider } from '@ali/ide-file-service';
import { FileServiceContribution } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { WorkspacePreferences } from '@ali/ide-workspace/lib/browser/workspace-preferences';
import { DiskFileSystemProvider } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
import { UserStorageContribution, UserStorageServiceImpl } from '@ali/ide-preferences/lib/browser/userstorage';
import { IUserStorageService } from '@ali/ide-preferences';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { DebugContribution, DebugModule } from '@ali/ide-debug/lib/browser';

@Injectable()
export class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() { },
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

      const rootPath = path.join(os.tmpdir(), 'launch-preference-test');
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

        await fs.ensureDir(rootPath);

        if (settings) {
          for (const configPath of configPaths) {
            const settingsPath = path.resolve(rootPath, configPath, 'settings.json');
            await fs.ensureFile(settingsPath);
            await fs.writeJSON(settingsPath, settings);
          }
        }
        if (launch) {
          for (const configPath of configPaths) {
            const launchPath = path.resolve(rootPath, configPath, 'launch.json');
            await fs.ensureFile(launchPath);
            await fs.writeJSON(launchPath, launch);
          }
        }

        injector = createBrowserInjector([
          FileServiceClientModule,
          PreferencesModule,
          DebugModule,
        ]);

        injector.overrideProviders(
          {
            token: IUserStorageService,
            useClass: UserStorageServiceImpl,
          },
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
            useValue: {
              preferenceDirName: '.kaitian',
            },
          },
          {
            token: IDiskFileProvider,
            useClass: DiskFileSystemProvider,
          },
          {
            token: ILoggerManagerClient,
            useClass: MockLoggerManagerClient,
          },
          UserStorageContribution,
        );

        injector.addProviders({
          token: IWorkspaceService,
          useClass: WorkspaceService,
        }, {
          token: WorkspacePreferences,
          useValue: {
            onPreferenceChanged: () => { },
          },
        });

        injector.overrideProviders({
          token: IWorkspaceService,
          useValue: {
            isMultiRootWorkspaceOpened: false,
            workspace: {
              uri: rootUri,
              isDirectory: true,
              lastModification: (new Date()).getTime(),
            },
            roots: Promise.resolve([
              {
                uri: rootUri,
                isDirectory: true,
                lastModification: (new Date()).getTime(),
              },
            ]),
            onWorkspaceChanged: () => {},
            onWorkspaceLocationChanged: () => {},
            tryGetRoots: () => [
              {
                uri: rootUri,
                isDirectory: true,
                lastModification: (new Date()).getTime(),
              },
            ],
          },
        });

        // 覆盖文件系统中的getCurrentUserHome方法，便于用户设置测试
        injector.mock(IFileServiceClient, 'getCurrentUserHome', () => {
          return {
            uri: new URI(rootPath).resolve('userhome').toString(),
            isDirectory: true,
            lastModification: new Date().getTime(),
          };
        });

        preferences = injector.get(PreferenceService);

        const fileServiceContribution = injector.get(FileServiceContribution);
        const userStorageContribution = injector.get(UserStorageContribution);
        const debugContribution = injector.get(DebugContribution);

        await fileServiceContribution.initialize();
        await userStorageContribution.initialize();
        await debugContribution.initialize();

        await preferences.ready;
        toTearDown.push(Disposable.create(() => injector.disposeAll()));
      };

      beforeEach(async (done) => {
        await initializeInjector();
        done();
      });

      afterEach(async (done) => {
        await fs.remove(rootPath);
        toTearDown.dispose();
        done();
      });

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
