import cloneDeep = require('lodash.clonedeep');

import { Uri, isObject } from '@opensumi/ide-core-common';

import { IExtHostWorkspace } from '../../../../common/vscode';

export class Configuration {
  private combinedConfig: ConfigurationModel | undefined;
  private folderCombinedConfigs: { [resource: string]: ConfigurationModel } = {};

  constructor(
    private defaultConfiguration: ConfigurationModel,
    private userConfiguration: ConfigurationModel,
    private workspaceConfiguration: ConfigurationModel = new ConfigurationModel(),
    private folderConfigurations: { [resource: string]: ConfigurationModel } = {},
  ) {}

  getValue(section: string | undefined, workspace: IExtHostWorkspace, resource?: Uri): any {
    return this.getCombinedResourceConfig(workspace, resource).getValue(section);
  }

  inspect<C>(
    key: string,
    workspace: IExtHostWorkspace,
    resource?: Uri,
  ): {
    default: C;
    user: C;
    workspace: C | undefined;
    workspaceFolder: C | undefined;
    value: C;
  } {
    const combinedConfiguration = this.getCombinedResourceConfig(workspace, resource);
    const folderConfiguration = this.getFolderResourceConfig(workspace, resource);
    return {
      default: this.defaultConfiguration.getValue(key),
      user: this.userConfiguration.getValue(key),
      workspace: workspace ? this.workspaceConfiguration.getValue(key) : void 0,
      workspaceFolder: folderConfiguration ? folderConfiguration.getValue(key) : void 0,
      value: combinedConfiguration.getValue(key),
    };
  }

  private getCombinedResourceConfig(workspace: IExtHostWorkspace, resource?: Uri): ConfigurationModel {
    const combinedConfig = this.getCombinedConfig();
    if (!workspace || !resource) {
      return combinedConfig;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(resource);
    if (!workspaceFolder) {
      return combinedConfig;
    }

    return this.getFolderCombinedConfig(workspaceFolder.uri.toString()) || combinedConfig;
  }

  private getCombinedConfig(): ConfigurationModel {
    if (!this.combinedConfig) {
      this.combinedConfig = this.defaultConfiguration.merge(this.userConfiguration, this.workspaceConfiguration);
    }
    return this.combinedConfig;
  }

  private getFolderCombinedConfig(folder: string): ConfigurationModel | undefined {
    if (this.folderCombinedConfigs[folder]) {
      return this.folderCombinedConfigs[folder];
    }

    const combinedConfig = this.getCombinedConfig();
    const folderConfig = this.folderConfigurations[folder];
    if (!folderConfig) {
      return combinedConfig;
    }

    const folderCombinedConfig = combinedConfig.merge(folderConfig);
    this.folderCombinedConfigs[folder] = folderCombinedConfig;

    return folderCombinedConfig;
  }

  private getFolderResourceConfig(workspace: IExtHostWorkspace, resource?: Uri): ConfigurationModel | undefined {
    if (!workspace || !resource) {
      return;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(resource);
    if (!workspaceFolder) {
      return;
    }
    return this.folderConfigurations[workspaceFolder.uri.toString()];
  }
}

export class ConfigurationModel {
  constructor(private contents: any = {}, private keys: string[] = []) {}

  getValue(section?: string): any {
    if (!section) {
      return this.contents;
    }

    const paths = section.split('.');
    let current = this.contents;
    for (const path of paths) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = current[path];
    }
    return current;
  }

  merge(...others: ConfigurationModel[]): ConfigurationModel {
    const contents = cloneDeep(this.contents);
    const allKeys = [...this.keys];

    for (const other of others) {
      this.mergeContents(contents, other.contents);
      this.mergeKeys(allKeys, other.keys);
    }
    return new ConfigurationModel(contents, allKeys);
  }

  private mergeContents(source: any, target: any): void {
    for (const key of Object.keys(target)) {
      if (key in source) {
        if (isObject(source[key]) && isObject(target[key])) {
          this.mergeContents(source[key], target[key]);
          continue;
        }
      }
      source[key] = cloneDeep(target[key]);
    }
  }

  private mergeKeys(source: string[], target: string[]): void {
    for (const key of target) {
      if (source.indexOf(key) === -1) {
        source.push(key);
      }
    }
  }
}

export interface ConfigurationChangeEvent {
  /**
   * @param section 配置名称，支持用`.`隔开的配置.
   * @param resource 资源路径
   * @return 当给定的资源文件修改了，返回true
   */
  affectsConfiguration(section: string, resource?: Uri): boolean;
}
