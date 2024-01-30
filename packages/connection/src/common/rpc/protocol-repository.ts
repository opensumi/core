import Fury, { Type, TypeDescription } from '@furyjs/fury';

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

  loadProtocol(
    protocol: TSumiProtocol,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    const { methods } = protocol;

    for (const proto of methods) {
      let method = proto.method;
      if (options?.nameConverter) {
        method = options.nameConverter(method);
      }

      const copy = {
        ...proto,
        method,
      };

      this.loadProtocolMethod(copy);
    }
  }

  loadProtocolMethod(methodProtocol: TSumiProtocolMethod) {
    const methodName = methodProtocol.method;
    const argsTuple = [] as TypeDescription[];

    for (const element of methodProtocol.request) {
      argsTuple.push(element.type);
    }

    const requestProto = Type.object(methodName + '^', {
      a: Type.tuple(argsTuple),
    });

    const resultProto = createResultProto(methodName + 'v', methodProtocol.response.type);

    this.serializerMap[methodName] = {
      request: this.fury.registerSerializer(requestProto),
      result: this.fury.registerSerializer(resultProto),
    };
  }

  serializeRequest(name: string, args: any[]): Uint8Array {
    const newArray = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = args[i];
    }

    const payload: ISerializableRequest = {
      a: newArray,
    };

    return this.serializerMap[name].request.serialize(payload);
  }

  deserializeRequest(name: string, buffer: Uint8Array): any[] {
    const { a: argsArray } = this.serializerMap[name].request.deserialize(buffer) as ISerializableRequest;
    return argsArray;
  }

  serializeResult<T = any>(name: string, result: T): Uint8Array {
    const payload = {
      r: result,
    } as ISerializableResult;

    payload.$ = ReturnValueTransfer.replacer(result);

    return this.serializerMap[name].result.serialize(payload);
  }

  deserializeResult<T = any>(name: string, buffer: Uint8Array): T {
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
