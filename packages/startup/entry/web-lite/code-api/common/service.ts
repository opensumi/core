import { Injectable, Autowired } from '@opensumi/di';
import {
  StorageProvider,
  IStorage,
  STORAGE_SCHEMA,
  URI,
  Deferred,
  CommandService,
  MessageType,
  localize,
} from '@opensumi/ide-core-common';
import { ClientAppStateService } from '@opensumi/ide-core-browser';
import { IMessageService } from '@opensumi/ide-overlay';
import { GITHUB_OAUTH_TOKEN } from './constant';
import { ICodePlatform } from './types';
import { CODE_PLATFORM_CONFIG } from './config';

/**
 * 使用 localStorage 存储 token 够用了
 * TODO: 需要简单加密下 token
 */

@Injectable()
export class HelperService {
  @Autowired(StorageProvider)
  private provideStorage: StorageProvider;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(ClientAppStateService)
  stateService: ClientAppStateService;

  private _storageDeferred: Deferred<IStorage>;

  async getStorage() {
    if (!this._storageDeferred) {
      this._storageDeferred = new Deferred();
      const storage = await this.provideStorage(new URI('code-api').withScheme(STORAGE_SCHEMA.SCOPE));
      this._storageDeferred.resolve(storage);
    }
    return this._storageDeferred.promise;
  }

  get(key: string) {
    return localStorage.getItem(key);
  }

  set(key: string, value: string) {
    localStorage.setItem(key, value);
  }

  delete(key: string) {
    localStorage.removeItem(key);
  }

  get GITHUB_TOKEN() {
    return this.get(GITHUB_OAUTH_TOKEN);
  }

  set GITHUB_TOKEN(value: string | null) {
    if (value === null) {
      this.delete(GITHUB_OAUTH_TOKEN);
    } else {
      this.set(GITHUB_OAUTH_TOKEN, value);
    }
  }

  async revealView(id: string) {
    await this.stateService.reachedState('ready');
    this.commandService.executeCommand(`workbench.view.${id}`);
  }

  reinitializeCodeService() {
    this.commandService.executeCommand('code-service.reinitialize');
  }

  showMessage(
    platform: ICodePlatform,
    msg: { type: MessageType; status?: number; symbol?: string; args?: any[]; message?: string },
    config?: { buttons?: string[]; closable?: boolean },
  ) {
    const message = `${status ? `${status} - ` : ''}${
      msg.symbol ? localize(msg.symbol, ...(msg.args || [])) : msg.message
    }`;
    return this.messageService.open(
      message,
      msg.type,
      config?.buttons,
      config?.closable,
      CODE_PLATFORM_CONFIG[platform].brand,
    );
  }
}
