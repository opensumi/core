export interface Request<T> {
  name: string;
  type: T;
}

export interface Response<T> {
  type: T;
}

export interface RPCProtocolMethod<T> {
  method: string;
  request: Request<T>[];
  response: Response<T>;
}

export interface RPCProtocol<T> {
  name: string;
  methods: RPCProtocolMethod<T>[];
}

export type PlatformBuffer = Uint8Array | Buffer;
