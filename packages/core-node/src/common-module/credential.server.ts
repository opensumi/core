import { Injectable, Autowired } from '@opensumi/di';
import { IChunkedPassword, INativeCredentialService, isWindows } from '@opensumi/ide-core-common';

import { AppConfig } from '../bootstrap';

@Injectable()
export class CredentialService implements INativeCredentialService {
  private static readonly MAX_PASSWORD_LENGTH = 2500;
  private static readonly PASSWORD_CHUNK_SIZE = CredentialService.MAX_PASSWORD_LENGTH - 100;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  async setPassword(service: string, account: string, password: string): Promise<void> {
    const keytar = await this.withKeytar();
    if (isWindows && password.length > CredentialService.MAX_PASSWORD_LENGTH) {
      let index = 0;
      let chunk = 0;
      let hasNextChunk = true;
      while (hasNextChunk) {
        const passwordChunk = password.substring(index, index + CredentialService.PASSWORD_CHUNK_SIZE);
        index += CredentialService.PASSWORD_CHUNK_SIZE;
        hasNextChunk = password.length - index > 0;

        const content: IChunkedPassword = {
          content: passwordChunk,
          hasNextChunk,
        };

        await keytar.setPassword(service, chunk ? `${account}-${chunk}` : account, JSON.stringify(content));
        chunk++;
      }
    } else {
      await keytar.setPassword(service, account, password);
    }
  }

  async deletePassword(service: string, account: string) {
    const keytar = await this.withKeytar();
    const didDelete = await keytar.deletePassword(service, account);
    return didDelete;
  }

  async getPassword(service: string, account: string) {
    const keytar = await this.withKeytar();
    const password = await keytar.getPassword(service, account);
    if (password) {
      try {
        let { content, hasNextChunk }: IChunkedPassword = JSON.parse(password);
        if (!content || !hasNextChunk) {
          return password;
        }

        let index = 1;
        while (hasNextChunk) {
          const nextChunk = await keytar.getPassword(service, `${account}-${index++}`);
          const result: IChunkedPassword = JSON.parse(nextChunk!);
          content += result.content;
          hasNextChunk = result.hasNextChunk;
        }

        return content;
      } catch {
        return password;
      }
    }
    return null;
  }

  async findPassword(service: string) {
    const keytar = await this.withKeytar();
    const password = await keytar.findPassword(service);
    if (password) {
      return password;
    }
    return null;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    const keytar = await this.withKeytar();
    return keytar.findCredentials(service);
  }

  private async withKeytar(): Promise<typeof import('keytar')> {
    if (this.appConfig.disableKeytar) {
      throw new Error('keytar has been disabled via --disable-keytar option');
    }
    return await import('keytar');
  }
}
