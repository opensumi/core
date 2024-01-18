import Fury, { Type, TypeDescription } from '@furyjs/fury';

import { PlatformBuffer } from '@opensumi/ide-core-common/lib/types/rpc';

import { getMethodName } from '../utils';

import { TSumiProtocol, TSumiProtocolMethod } from './types';

export interface ISerializableRequest {
  /**
   * Arguments
   */
  a: any[];
}

export interface ISerializableResult {
  /**
   * function execute result
   */
  r: any;

  /**
   * Function Return void or other type that protocol not defined
   */
  $?: string;
}

const createResultProto = (name: string, type?: TypeDescription) => {
  const props = {
    $: Type.string(),
  } as Record<string, TypeDescription>;
  if (type) {
    props.r = type;
  }
  return Type.object(name, props);
};

export class ProtocolRepository {
  fury = new Fury();

  private serializerMap = {} as Record<
    string,
    {
      request: ReturnType<Fury['registerSerializer']>;
      result: ReturnType<Fury['registerSerializer']>;
    }
  >;

  has(name: string) {
    return !!this.serializerMap[name];
  }

  loadProtocol(protocol: TSumiProtocol) {
    const { methods, name } = protocol;

    for (const proto of methods) {
      this.loadProtocolMethod(getMethodName(name, proto.method), proto);
    }
  }

  loadProtocolMethod(name: string, protocol: TSumiProtocolMethod) {
    const argsTuple = [] as TypeDescription[];

    for (const element of protocol.request) {
      argsTuple.push(element.type);
    }

    const requestProto = Type.object(name + '^', {
      a: Type.tuple(argsTuple),
    });

    const resultProto = createResultProto(name + 'v', protocol.response.type);

    this.serializerMap[name] = {
      request: this.fury.registerSerializer(requestProto),
      result: this.fury.registerSerializer(resultProto),
    };
  }

  serializeRequest(name: string, args: any[]): PlatformBuffer {
    const newArray = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = args[i];
    }

    const payload: ISerializableRequest = {
      a: newArray,
    };

    return this.serializerMap[name].request.serialize(payload);
  }

  deserializeRequest(name: string, buffer: PlatformBuffer): any[] {
    const { a: argsArray } = this.serializerMap[name].request.deserialize(buffer) as ISerializableRequest;
    return argsArray;
  }

  serializeResult<T = any>(name: string, result: T): PlatformBuffer {
    const payload = {
      r: result,
    } as ISerializableResult;

    payload.$ = ReturnValueTransfer.replacer(result);

    return this.serializerMap[name].result.serialize(payload);
  }

  deserializeResult<T = any>(name: string, buffer: PlatformBuffer): T {
    const payload = this.serializerMap[name].result.deserialize(buffer) as ISerializableResult;

    if (payload.$) {
      return ReturnValueTransfer.reviver(payload.$);
    }

    return payload.r;
  }
}

class ReturnValueTransfer {
  static TypeUndefined = '$undefined';

  static replacer(value: any) {
    if (typeof value === 'undefined') {
      return ReturnValueTransfer.TypeUndefined;
    }
    return undefined;
  }

  static reviver(value: any): any {
    if (value === ReturnValueTransfer.TypeUndefined) {
      return undefined;
    }

    throw new Error('Not implemented');
  }
}
