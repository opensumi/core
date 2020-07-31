import { Injectable, Autowired } from '@ali/common-di';
import { ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { IFileDropFrontendService, IFileDropFrontendServiceToken } from '../common';
import { OnEvent, FileTreeDropEvent, WithEventBus } from '@ali/ide-core-common';

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
