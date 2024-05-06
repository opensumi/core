export interface Headers {
  chunked?: boolean;
}

export interface Request<T> {
  name: string;
  type: T;
}

export interface Response<T> {
  /**
   * If the method no return value, the response type is void.
   */
  type?: T;
}

export interface RPCProtocolMethod<T> {
  method: string;
  request: Request<T>[];
  response?: Response<T>;
}

export interface RPCProtocol<T> {
  name: string;
  methods: RPCProtocolMethod<T>[];
}
