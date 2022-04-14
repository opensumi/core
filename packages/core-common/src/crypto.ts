export const CryptoServicePath = '/services/crypto';

export const INativeCryptoService = Symbol('INativeCryptoService');

export interface INativeCryptoService {
  decrypt(hash: string): Promise<string>;
  encrypt(password: string): Promise<string>;
}
