import { Injectable, Autowired } from '@opensumi/di';
import { INativeCryptrService, CryptrServicePath } from '@opensumi/ide-core-common';

export const ICryptrService = Symbol('ICryptrService');

export interface ICryptrService {
  decrypt(hash: string): Promise<string>;
  encrypt(password: string): Promise<string>;
}

@Injectable()
export class CryptrService implements ICryptrService {
  @Autowired(CryptrServicePath)
  private readonly cryptrService: INativeCryptrService;

  async encrypt(password: string) {
    return await this.cryptrService.encrypt(password);
  }

  async decrypt(hash: string) {
    return await this.cryptrService.decrypt(hash);
  }
}
