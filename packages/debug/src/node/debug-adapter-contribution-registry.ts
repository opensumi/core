import { Injectable, Autowired } from '@ali/common-di';
import { ContributionProvider, IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-node';
import { DebugConfiguration } from '../common/debug-configuration';
import { DebuggerDescription, DebugError } from '../common/debug-service';

import { DebugAdapterContribution, DebugAdapterExecutable, DebugAdapterSessionFactory } from '../common/debug-model';

@Injectable()
export class DebugAdapterContributionRegistry {

  @Autowired(DebugAdapterContribution)
  protected readonly contributions: ContributionProvider<DebugAdapterContribution>;

  protected getContributions(debugType: string): DebugAdapterContribution[] {
    const contributions: DebugAdapterContribution[] = [];
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.type === debugType || contribution.type === '*' || debugType === '*') {
        contributions.push(contribution);
      }
    }
    return contributions;
  }

  protected _debugTypes: string[] | undefined;
  debugTypes(): string[] {
    if (!this._debugTypes) {
      const result = new Set<string>();
      for (const contribution of this.contributions.getContributions()) {
        result.add(contribution.type);
      }
      this._debugTypes = [...result];
    }
    return this._debugTypes;
  }

  async getDebuggersForLanguage(language: string): Promise<DebuggerDescription[]> {
    const debuggers: DebuggerDescription[] = [];
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.languages && contribution.label) {
        const label = await contribution.label;
        if (label && (await contribution.languages || []).indexOf(language) !== -1) {
          debuggers.push({
            type: contribution.type,
            label,
          });
        }
      }
    }
    return debuggers;
  }

  /**
   * 提供初始化配置
   * @param debugType
   * @param workspaceFolderUri
   */
  async provideDebugConfigurations(debugType: string, workspaceFolderUri?: string): Promise<DebugConfiguration[]> {
    const configurations: DebugConfiguration[] = [];
    for (const contribution of this.getContributions(debugType)) {
      if (contribution.provideDebugConfigurations) {
        try {
          const result = await contribution.provideDebugConfigurations(workspaceFolderUri);
          configurations.push(...result);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return configurations;
  }

  /**
   * 补全配置缺省值
   * @param config
   * @param workspaceFolderUri
   */
  async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri?: string): Promise<DebugConfiguration> {
    let current = config;
    for (const contribution of this.getContributions(config.type)) {
      if (contribution.resolveDebugConfiguration) {
        try {
          const next = await contribution.resolveDebugConfiguration(config, workspaceFolderUri);
          if (next) {
            current = next;
          } else {
            return current;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return current;
  }

  /**
   * 获取schema属性
   * @param debugType
   */
  async getSchemaAttributes(debugType: string): Promise<IJSONSchema[]> {
    const schemas: IJSONSchema[] = [];
    for (const contribution of this.getContributions(debugType)) {
      if (contribution.getSchemaAttributes) {
        try {
          schemas.push(...await contribution.getSchemaAttributes());
        } catch (e) {
          console.error(e);
        }
      }
    }
    return schemas;
  }
  /**
   * 获取配置片段
   */
  async getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    const schemas: IJSONSchemaSnippet[] = [];
    for (const contribution of this.getContributions('*')) {
      if (contribution.getConfigurationSnippets) {
        try {
          schemas.push(...await contribution.getConfigurationSnippets());
        } catch (e) {
          console.error(e);
        }
      }
    }
    return schemas;
  }

  /**
   * 基于传入配置提供可执行的DA
   * @param config
   */
  async provideDebugAdapterExecutable(config: DebugConfiguration): Promise<DebugAdapterExecutable> {
    let { type } = config;
    if (config.type === 'node') {
      if (config.protocol === 'legacy') {
        type = 'node';
      }
      if (config.protocol === 'inspector') {
        type = 'node2';
      }
    }
    for (const contribution of this.getContributions(type)) {
      if (contribution.provideDebugAdapterExecutable) {
        const executable = await contribution.provideDebugAdapterExecutable(config);
        if (executable) {
          return executable;
        }
      }
    }
    throw DebugError.NotFound(type);
  }

  /**
   * 根据调试类型返回DA进程生成函数
   * @param debugType
   */
  debugAdapterSessionFactory(debugType: string): DebugAdapterSessionFactory | undefined {
    for (const contribution of this.getContributions(debugType)) {
      if (contribution.debugAdapterSessionFactory) {
        return contribution.debugAdapterSessionFactory;
      }
    }
    return undefined;
  }
}
