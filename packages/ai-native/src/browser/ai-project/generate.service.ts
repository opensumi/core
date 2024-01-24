import { observable, computed } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { IAIReporter } from '@opensumi/ide-core-browser';
import { ILogServiceClient, ILoggerManagerClient, SupportLogNamespace } from '@opensumi/ide-core-common';
import { AiBackSerivcePath } from '@opensumi/ide-core-common/lib/ai-native';
import { IAiBackService } from '@opensumi/ide-core-common/lib/ai-native';

@Injectable()
export class AiProjectGenerateService {
  @Autowired(AiBackSerivcePath)
  aiBackService: IAiBackService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  @Autowired(IAIReporter)
  readonly reporter: IAIReporter;

  protected logger: ILogServiceClient;

  protected codeStructure: string;

  private releationId?: string; // 用于数据埋点，可空

  @observable
  protected _requirements?: Record<string, any>;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  public initRequirements(requirements?: Record<string, any>, relationId?: string) {
    this._requirements = requirements;
    this.releationId = relationId;
  }

  @computed
  public get requirements() {
    return this._requirements;
  }

  public async start(
    callback: (
      messageList: Array<{ message: string; relationId: string; immediately?: boolean; type?: string }>,
    ) => void,
  ) {
    callback([]);
  }
}
