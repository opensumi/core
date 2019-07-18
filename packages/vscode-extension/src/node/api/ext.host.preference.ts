import { Configuration, ConfigurationChangeEvent, ConfigurationModel } from '../preferences';
import { MainThreadAPIIdentifier, IMainThreadPreference, IExtHostPreference, PreferenceChangeExt, PreferenceData } from '../../common';
import { Emitter, Event, PreferenceScope } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';
import { Uri } from '../../common/ext-types';

/**
 * 查找属性对应值
 * @param {*} tree
 * @param {string} key
 * @returns {*}
 */
function lookUp(tree: any, key: string): any {
  if (!key) {
    return;
  }

  const parts = key.split('.');
  let node = tree;
  for (let i = 0; node && i < parts.length; i++) {
    node = node[parts[i]];
  }
  return node;
}

export class ExtHostPreference implements IExtHostPreference {
  private proxy: IMainThreadPreference;
  private _preferences: Configuration;
  protected readonly rpcProtocol: IRPCProtocol;
  private readonly _onDidChangeConfiguration = new Emitter<ConfigurationChangeEvent>();
  readonly onDidChangeConfiguration: Event<ConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadPreference);
  }

  init(data: PreferenceData): void {
    this._preferences = this.parse(data);
  }

  $acceptConfigurationChanged(data: { [key: string]: any }, eventData: PreferenceChangeExt[]) {
    this.init(data);
    this._onDidChangeConfiguration.fire(this.toConfigurationChangeEvent(eventData));
  }

  parse(data: PreferenceData) {
    const defaultConfiguration = this.getConfigurationModel(data[PreferenceScope.Default]);
    const userConfiguration = this.getConfigurationModel(data[PreferenceScope.User]);
    const workspaceConfiguration = this.getConfigurationModel(data[PreferenceScope.Workspace]);
    const folderConfigurations = {} as { [resource: string]: ConfigurationModel };
    Object.keys(data[PreferenceScope.Folder]).forEach((resource) => {
      folderConfigurations[resource] = this.getConfigurationModel(data[PreferenceScope.Folder][resource]);
    });
    return new Configuration(defaultConfiguration, userConfiguration, workspaceConfiguration, folderConfigurations);
  }

  private getConfigurationModel(data: { [key: string]: any }): ConfigurationModel {
    if (!data) {
      return new ConfigurationModel();
    }
    return new ConfigurationModel(this.parseConfigurationData(data), Object.keys(data));
  }

  private readonly OVERRIDE_PROPERTY = '\\[(.*)\\]$';
  private readonly OVERRIDE_PROPERTY_PATTERN = new RegExp(this.OVERRIDE_PROPERTY);

  private parseConfigurationData(data: { [key: string]: any }): { [key: string]: any } {
    return Object.keys(data).reduce((result: any, key: string) => {
      const parts = key.split('.');
      let branch = result;

      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) {
          branch[parts[i]] = data[key];
          continue;
        }
        if (!branch[parts[i]]) {
          branch[parts[i]] = {};
        }
        branch = branch[parts[i]];

        // overridden 的属性，如languages的 [typescript].editor.tabsize 转换为
        // "[typescript]" : {
        //    "editor.tabsize" : "2"
        //  }
        if (i === 0 && this.OVERRIDE_PROPERTY_PATTERN.test(parts[i])) {
          branch[key.substring(parts[0].length + 1)] = data[key];
          break;
        }
      }
      return result;
    }, {});
  }

  private toConfigurationChangeEvent(eventData: PreferenceChangeExt[]): ConfigurationChangeEvent {
    return Object.freeze({
      affectsConfiguration: (section: string, uri?: Uri): boolean => {
        for (const change of eventData) {
          const tree = change.preferenceName
            .split('.')
            .reverse()
            .reduce((prevValue: any, curValue: any) => ({ [curValue]: prevValue }), change.newValue);
          return typeof lookUp(tree, section) !== 'undefined';
        }
        return false;
      },
    });
  }
}
