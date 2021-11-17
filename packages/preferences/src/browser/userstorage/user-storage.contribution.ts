import { Autowired } from '@ide-framework/common-di';
import {
  Domain,
  ClientAppContribution,
} from '@ide-framework/ide-core-browser';
import { IFileServiceClient } from '@ide-framework/ide-file-service';
import { FileServiceClient } from '@ide-framework/ide-file-service/lib/browser/file-service-client';
import { USER_STORAGE_SCHEME, IUserStorageService } from '../../common';

@Domain(ClientAppContribution)
export class UserStorageContribution implements ClientAppContribution {
  @Autowired(IUserStorageService)
  private readonly userStorageService: IUserStorageService;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  initialize() {
    this.fileSystem.registerProvider(USER_STORAGE_SCHEME, this.userStorageService);
  }
}
