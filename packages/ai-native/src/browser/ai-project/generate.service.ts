import { observable, computed } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { ILogServiceClient, ILoggerManagerClient, SupportLogNamespace } from '@opensumi/ide-core-common';

import { AiGPTBackSerivcePath } from '../../common';

export interface Requirements {
  language: string;
  framework: string;
  requirements: string;
}

@Injectable()
export class AiProjectGenerateService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  private logger: ILogServiceClient;

  @observable
  private _requirements: Requirements;
  
  private codeStructure: string;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  public initRequirements(requirements: Requirements) {
    this._requirements = requirements;
  }

  @computed
  public get requirements() {
    return this._requirements
  }

  /**
   * 生成项目目录结构
   * ['src/app/main/demo.java', 'src/app/test/demo.jsva']
   * @returns 
   */
  public async generateProjectStructure(): Promise<string[]> {
    return []
  }
  /**
   * 生成文件
   * @param filePathList 文件列表，完整路径
   * @param callback 回调函数，用来触发聊天输出
   */
  public async generateFile(filePathList: string[], callback: (path: string) => void) {}

  public async clearWorkspace() {
    await this.aiBackService.clearWorkspace();
  }
}
