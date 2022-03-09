import crypto from 'crypto';

import { Injectable } from '@opensumi/di';
import { INativeCryptrService } from '@opensumi/ide-core-common';

@Injectable()
export class CryptrService implements INativeCryptrService {
  private static SECRET_KEY = 'CryptrService';
  private static IV_LENGTH = 16;
  private static SALT_LENGTH = 64;
  private static TAG_LENGTH = 16;
  private static ALGORITHM = 'aes-256-gcm';
  private static TAG_POSITION: number = CryptrService.SALT_LENGTH + CryptrService.IV_LENGTH;
  private static ENCRYPTED_POSITION: number = CryptrService.TAG_POSITION + CryptrService.TAG_LENGTH;

  private getKey(salt: string | Buffer) {
    return crypto.pbkdf2Sync(CryptrService.SECRET_KEY, salt, 100000, 32, 'sha512');
  }

  async encrypt(password: string) {
    const iv = crypto.randomBytes(CryptrService.IV_LENGTH);
    const salt = crypto.randomBytes(CryptrService.SALT_LENGTH);

    const key = this.getKey(salt);

    const cipher = crypto.createCipheriv(CryptrService.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);

    const tag = (cipher as any).getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
  }

  async decrypt(hash: string) {
    const stringValue = Buffer.from(String(hash), 'hex');

    const salt = stringValue.slice(0, CryptrService.SALT_LENGTH);
    const iv = stringValue.slice(CryptrService.SALT_LENGTH, CryptrService.TAG_POSITION);
    const tag = stringValue.slice(CryptrService.TAG_POSITION, CryptrService.ENCRYPTED_POSITION);
    const encrypted = stringValue.slice(CryptrService.ENCRYPTED_POSITION);

    const key = this.getKey(salt);

    const decipher = crypto.createDecipheriv(CryptrService.ALGORITHM, key, iv);

    (decipher as any).setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
