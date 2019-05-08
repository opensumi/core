import { Provider } from '@ali/common-di';

export const REQUESTER_TOKEN = Symbol('REQUESTER_TOKEN');

export interface Request {
  domain: string;
  method: string;
  args: any[];
}

export abstract class Requester {
  abstract send(request: Request): Promise<any>;
}

export function createRequesterProvider(value: Requester): Provider {
  return {
    token: REQUESTER_TOKEN,
    useValue: value,
  };
}
