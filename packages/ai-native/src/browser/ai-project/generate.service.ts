import { observable, computed } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { ILogServiceClient, ILoggerManagerClient, SupportLogNamespace } from '@opensumi/ide-core-common';

import { AiGPTBackSerivcePath } from '../../common';

@Injectable()
export class AiProjectGenerateService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  protected logger: ILogServiceClient;

  protected codeStructure: string;

  @observable
  protected _requirements?: Record<string, any>;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  public initRequirements(requirements?: Record<string, any>) {
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
