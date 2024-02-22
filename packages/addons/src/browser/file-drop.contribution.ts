import { Autowired, Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { FileTreeDropEvent, OnEvent, WithEventBus } from '@opensumi/ide-core-common';

import { IFileDropFrontendService, IFileDropFrontendServiceToken } from '../common';

@Injectable()
@Domain(ClientAppContribution)
export class FileDropContribution extends WithEventBus {
  @Autowired(IFileDropFrontendServiceToken)
  protected readonly dropService: IFileDropFrontendService;

  @OnEvent(FileTreeDropEvent)
  onDidDropFile(e: FileTreeDropEvent) {
    this.dropService.onDidDropFile(e);
  }
}
