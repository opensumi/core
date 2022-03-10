/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/preference-registry.ts

import cloneDeep = require('lodash.clonedeep');

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, PreferenceScope, isObject, mixin, isUndefined } from '@opensumi/ide-core-common';

import {
  MainThreadAPIIdentifier,
  IMainThreadPreference,
  IExtHostPreference,
  PreferenceChangeExt,
  PreferenceData,
  WorkspaceConfiguration,
  IExtHostWorkspace,
  ConfigurationTarget,
} from '../../../common/vscode';
import { Uri } from '../../../common/vscode/ext-types';

import { Configuration, ConfigurationChangeEvent, ConfigurationModel } from './preferences';


interface ConfigurationInspect<T> {
  key: string;
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
}

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

  constructor(rpcProtocol: IRPCProtocol, private readonly workspace: IExtHostWorkspace) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadPreference);
  }

  init(data: PreferenceData): void {
    this._preferences = this.parse(data);
  }

  $initializeConfiguration(data: any): void {
    this.init(data);
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
    return (
      Object.keys(data)
        // 配置项按字段长度从大到小排序，方便后续自然过滤有包含关系的配置项
        // 如当前如果存在 a.b 声明为 string，而又有 a.b.c 的声明
        // 则这里默认应该忽略掉 a.b 的声明
        .sort((keyA, keyB) => keyB.length - keyA.length)
        .reduce((result: any, key: string) => {
          const parts = key.split('.');
          let branch = result;
          for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) {
              if (isUndefined(branch[parts[i]])) {
                // 仅当值为 undefined 时使用配置项的默认值
                branch[parts[i]] = data[key];
              }
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
        }, {})
    );
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

  getConfiguration(section?: string, resource?: Uri | null, extensionId?: string): WorkspaceConfiguration {
    resource = resource === null ? undefined : resource;
    const preferences = this.toReadonlyValue(
      section
        ? lookUp(this._preferences.getValue(undefined, this.workspace, resource), section)
        : this._preferences.getValue(undefined, this.workspace, resource),
    );
    const configuration: WorkspaceConfiguration = {
      has(key: string): boolean {
        return typeof lookUp(preferences, key) !== 'undefined';
      },
      get: <T>(key: string, defaultValue?: T) => {
        const result = lookUp(preferences, key);
        if (typeof result === 'undefined') {
          return defaultValue;
        } else {
          let clonedConfig: any;
          const cloneOnWriteProxy = (target: any, accessor: string): any => {
            let clonedTarget: any;
            const cloneTarget = () => {
              clonedConfig = clonedConfig ? clonedConfig : cloneDeep(preferences);
              clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
            };
            if (!isObject(target)) {
              return target;
            }
            return new Proxy(target, {
              get: (targ: any, prop: string) => {
                if (typeof prop === 'string' && prop.toLowerCase() === 'tojson') {
                  cloneTarget();
                  // 当调用过配置对象的toJSON方法后，会固化某一份配置的配置值
                  // 从而保障在某些情况下插件的配置值不被外部改变
                  return () => clonedTarget;
                }
                if (clonedConfig) {
                  // 当存在克隆过的配置对象时，直接从缓存对象中获取属性值
                  clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
                  return clonedTarget[prop];
                }

                const res = targ[prop];
                if (typeof prop === 'string') {
                  return cloneOnWriteProxy(res, `${accessor}.${prop}`);
                }
                return res;
              },
              set: (targ: any, prop: string, val: any) => {
                cloneTarget();
                clonedTarget[prop] = val;
                return true;
              },
              deleteProperty: (targ: any, prop: string) => {
                cloneTarget();
                delete clonedTarget[prop];
                return true;
              },
              defineProperty: (targ: any, prop: string, descr: any) => {
                cloneTarget();
                Object.defineProperty(clonedTarget, prop, descr);
                return true;
              },
            });
          };
          return cloneOnWriteProxy(result, key);
        }
      },
      update: (key: string, value: any, arg?: ConfigurationTarget | boolean): PromiseLike<void> => {
        key = section ? `${section}.${key}` : key;
        const resourceStr: string | undefined = resource ? resource.toString() : undefined;
        if (typeof value !== 'undefined') {
          return this.proxy.$updateConfigurationOption(arg, key, value, resourceStr);
        } else {
          return this.proxy.$removeConfigurationOption(arg, key, resourceStr);
        }
      },
      inspect: <T>(key: string): ConfigurationInspect<T> | undefined => {
        key = section ? `${section}.${key}` : key;
        resource = resource === null ? undefined : resource;
        const result = cloneDeep(this._preferences.inspect<T>(key, this.workspace, resource));

        if (!result) {
          return undefined;
        }

        const configInspect: ConfigurationInspect<T> = { key };
        if (typeof result.default !== 'undefined') {
          configInspect.defaultValue = result.default;
        }
        if (typeof result.user !== 'undefined') {
          configInspect.globalValue = result.user;
        }
        if (typeof result.workspace !== 'undefined') {
          configInspect.workspaceValue = result.workspace;
        }
        if (typeof result.workspaceFolder !== 'undefined') {
          configInspect.workspaceFolderValue = result.workspaceFolder;
        }
        return configInspect;
      },
    };

    if (typeof preferences === 'object') {
      mixin(configuration, preferences, false);
    }

    return Object.freeze(configuration);
  }

  private toReadonlyValue(data: any): any {
    const readonlyProxy = (target: any): any =>
      isObject(target)
        ? new Proxy(target, {
            get: (targ: any, prop: string) => readonlyProxy(targ[prop]),
            set: (targ: any, prop: string, val: any) => {
              throw new Error(`TypeError: Cannot assign to read only property '${prop}' of object`);
            },
            deleteProperty: (targ: any, prop: string) => {
              throw new Error(`TypeError: Cannot delete read only property '${prop}' of object`);
            },
            defineProperty: (targ: any, prop: string) => {
              throw new Error(`TypeError: Cannot define property '${prop}' of a readonly object`);
            },
            setPrototypeOf: (targ: any) => {
              throw new Error('TypeError: Cannot set prototype for a readonly object');
            },
            isExtensible: () => false,
            preventExtensions: () => true,
          })
        : target;
    return readonlyProxy(data);
  }
}
