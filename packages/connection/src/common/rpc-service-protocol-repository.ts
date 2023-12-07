import Fury, { Type, TypeDescription } from '@furyjs/fury';

import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { RPCProtocol, RPCProtocolMethod } from './binary-rpc';
import { getMethodName } from './utils';

export interface ISerializableRequest {
  args: ISerializableArguments;
}

export interface ISerializableArguments {
  len: number;
  [key: number]: any;
}

export class RPCServiceProtocolRepository {
  fury = new Fury({
    refTracking: true,
  });

  private serializerMap = {} as Record<
    string,
    {
      requestType: TypeDescription;
      request: ReturnType<Fury['registerSerializer']>;
      resultType: TypeDescription;
      result: ReturnType<Fury['registerSerializer']>;
    }
  >;

  has(name: string) {
    return !!this.serializerMap[name];
  }

  loadProtocol(protocol: RPCProtocol) {
    const { methods, name } = protocol;

    for (const proto of methods) {
      this.loadProtocolMethod(getMethodName(name, proto.method), proto);
    }
  }

  loadProtocolMethod(name: string, protocol: RPCProtocolMethod) {
    const { method } = protocol;

    const props = {
      len: Type.uint8(),
    } as Record<string, TypeDescription>;
    for (let argN = 0; argN < protocol.request.length; argN++) {
      const element = protocol.request[argN];
      props[argN + ''] = element.type;
    }

    const requestType = Type.object(method + 'request', {
      args: Type.object(method + 'args' + protocol.request.length, props),
    });

    const resultType = Type.object(method + 'result', {
      result: protocol.response.type,
      error: Type.object(method + 'error', {
        message: Type.string(),
        stack: Type.string(),
      }),
    });

    const requestSerializer = this.fury.registerSerializer(requestType);
    const resultSerializer = this.fury.registerSerializer(resultType);

    this.serializerMap[name] = {
      requestType,
      resultType,
      request: requestSerializer,
      result: resultSerializer,
    };
  }

  serializeRequest(name: string, args: any[]): PlatformBuffer {
    const serializableArgs = {
      len: args.length,
    } as ISerializableArguments;
    for (let i = 0; i < args.length; i++) {
      serializableArgs[i] = args[i];
    }

    const payload: ISerializableRequest = {
      args: serializableArgs,
    };

    return this.serializerMap[name].request.serialize(payload);
  }

  deserializeRequest(name: string, buffer: PlatformBuffer): any[] {
    const { args } = this.serializerMap[name].request.deserialize(buffer) as ISerializableRequest;

    const argsArray = [] as any[];
    for (let i = 0; i < args.len; i++) {
      argsArray.push(args[i]);
    }
    return argsArray;
  }

  serializeResult(name: string, result: any): PlatformBuffer {
    const payload = {
      result,
      error: {
        message: '',
        stack: '',
      },
    };
    return this.serializerMap[name].result.serialize(payload);
  }

  deserializeResult(name: string, buffer: PlatformBuffer): any {
    const payload = this.serializerMap[name].result.deserialize(buffer) as any;
    return payload.result;
  }
}
