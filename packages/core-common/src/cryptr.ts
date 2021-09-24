export const CryptrServicePath = '/services/cryptr';

export const INativeCryptrService = Symbol('INativeCryptrService');

export interface INativeCryptrService {
  decrypt(hash: string): Promise<string>;
  encrypt(password: string): Promise<string>;
}