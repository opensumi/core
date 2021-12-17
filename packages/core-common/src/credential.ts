export const KeytarServicePath = '/services/keytar';

export const INativeCredentialService = Symbol('INativeCredentialService');

export interface INativeCredentialService {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findPassword(service: string): Promise<string | null>;
  findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
}

export interface IChunkedPassword {
  content: string;
  hasNextChunk: boolean;
}

export interface ICredentialsChangeEvent {
  service: string;
  account: string;
}
