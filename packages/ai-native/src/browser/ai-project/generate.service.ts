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

  protected logger: ILogServiceClient;

  protected codeStructure: string;

  @observable
  protected _requirements?: Requirements;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  public initRequirements(requirements?: Requirements) {
    this._requirements = requirements;
  }

  @computed
  public get requirements() {
    return this._requirements;
  }

  public async start(callback: (messageList: Array<{ message: string; immediately?: boolean }>) => void) {
    callback([]);
  }
}
