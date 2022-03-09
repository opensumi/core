import { Injectable, Autowired } from '@opensumi/di';
import {
  Emitter,
  ICredentialsChangeEvent,
  INativeCredentialService,
  KeytarServicePath,
} from '@opensumi/ide-core-common';
import { Event } from '@opensumi/ide-core-common';

export const ICredentialsService = Symbol('ICredentialsService');

export interface ICredentialsProvider {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findPassword(service: string): Promise<string | null>;
  findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
}

export interface ICredentialsService extends ICredentialsProvider {
  readonly onDidChangePassword: Event<ICredentialsChangeEvent>;
}

export interface CredentialsChangeEvent {
  service: string;
  account: string;
}

@Injectable()
export class CredentialsService implements ICredentialsService {
  private onDidChangePasswordEmitter = new Emitter<CredentialsChangeEvent>();
  readonly onDidChangePassword = this.onDidChangePasswordEmitter.event;

  private credentialsProvider: ICredentialsProvider;

  @Autowired(KeytarServicePath)
  private readonly keytarService: INativeCredentialService;

  constructor() {
    this.credentialsProvider = new KeytarCredentialsProvider(this.keytarService);
  }

  async getPassword(service: string, account: string) {
    return this.credentialsProvider.getPassword(service, account);
  }

  async setPassword(service: string, account: string, password: string) {
    await this.credentialsProvider.setPassword(service, account, password);

    this.onDidChangePasswordEmitter.fire({ service, account });
  }

  async deletePassword(service: string, account: string) {
    const didDelete = await this.credentialsProvider.deletePassword(service, account);
    this.onDidChangePasswordEmitter.fire({ service, account });

    return didDelete;
  }

  async findPassword(service: string) {
    return await this.credentialsProvider.findPassword(service);
  }

  async findCredentials(service: string) {
    return await this.credentialsProvider.findCredentials(service);
  }
}

class KeytarCredentialsProvider implements ICredentialsProvider {
  constructor(private readonly keytarService: INativeCredentialService) {}

  deletePassword(service: string, account: string): Promise<boolean> {
    return this.keytarService.deletePassword(service, account);
  }

  findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    return this.keytarService.findCredentials(service);
  }

  async findPassword(service: string) {
    return await this.keytarService.findPassword(service);
  }

  async getPassword(service: string, account: string) {
    return await this.keytarService.getPassword(service, account);
  }

  async setPassword(service: string, account: string, password: string) {
    return await this.keytarService.setPassword(service, account, password);
  }
}
