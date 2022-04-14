import crypto from 'crypto';

import { Injectable } from '@opensumi/di';
import { INativeCryptoService } from '@opensumi/ide-core-common';

@Injectable()
export class CryptoService implements INativeCryptoService {
  private static SECRET_KEY = 'CryptoService';
  private static IV_LENGTH = 16;
  private static SALT_LENGTH = 64;
  private static TAG_LENGTH = 16;
  private static ALGORITHM = 'aes-256-gcm';
  private static TAG_POSITION: number = CryptoService.SALT_LENGTH + CryptoService.IV_LENGTH;
  private static ENCRYPTED_POSITION: number = CryptoService.TAG_POSITION + CryptoService.TAG_LENGTH;

  private getKey(salt: string | Buffer) {
    return crypto.pbkdf2Sync(CryptoService.SECRET_KEY, salt, 100000, 32, 'sha512');
  }

  async encrypt(password: string) {
    const iv = crypto.randomBytes(CryptoService.IV_LENGTH);
    const salt = crypto.randomBytes(CryptoService.SALT_LENGTH);

    const key = this.getKey(salt);

    const cipher = crypto.createCipheriv(CryptoService.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);

    const tag = (cipher as any).getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
  }

  async decrypt(hash: string) {
    const stringValue = Buffer.from(String(hash), 'hex');

    const salt = stringValue.slice(0, CryptoService.SALT_LENGTH);
    const iv = stringValue.slice(CryptoService.SALT_LENGTH, CryptoService.TAG_POSITION);
    const tag = stringValue.slice(CryptoService.TAG_POSITION, CryptoService.ENCRYPTED_POSITION);
    const encrypted = stringValue.slice(CryptoService.ENCRYPTED_POSITION);

    const key = this.getKey(salt);

    const decipher = crypto.createDecipheriv(CryptoService.ALGORITHM, key, iv);

    (decipher as any).setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
