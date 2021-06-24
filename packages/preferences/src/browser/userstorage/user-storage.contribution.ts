import { Autowired } from '@ali/common-di';
import {
  Domain,
  ClientAppContribution,
} from '@ali/ide-core-browser';
import { IFileServiceClient } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
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
