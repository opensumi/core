import Fury, { Type, TypeDescription } from '@furyjs/fury';

import { anySerializer } from '../fury-extends/any';

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

type TSerializer = ReturnType<Fury['registerSerializer']>;

interface IProtocolProcessor {
  serializeRequest(args: any[]): Uint8Array;
  deserializeRequest(buffer: Uint8Array): any[];
  serializeResult<T = any>(result: T): Uint8Array;
  deserializeResult<T = any>(buffer: Uint8Array): T;
}

class SumiProtocolProcessor implements IProtocolProcessor {
  request: TSerializer;
  result: TSerializer;

  constructor(methodProtocol: TSumiProtocolMethod, public fury: Fury) {
    const methodName = methodProtocol.method;

    const argsTuple = [] as TypeDescription[];

    for (const element of methodProtocol.request) {
      argsTuple.push(element.type);
    }

    const requestProto = Type.object(methodName + '^', {
      a: Type.tuple(argsTuple),
    });

    const resultProto = createResultProto(methodName + 'v', methodProtocol.response.type);

    this.request = this.fury.registerSerializer(requestProto);
    this.result = this.fury.registerSerializer(resultProto);
  }

  serializeRequest(args: any[]): Uint8Array {
    const newArray = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = args[i];
    }

    const payload: ISerializableRequest = {
      a: newArray,
    };

    return this.request.serialize(payload);
  }

  deserializeRequest(buffer: Uint8Array): any[] {
    const { a: argsArray } = this.request.deserialize(buffer) as ISerializableRequest;
    return argsArray;
  }

  serializeResult<T = any>(result: T): Uint8Array {
    const payload = {
      r: result,
    } as ISerializableResult;

    payload.$ = ReturnValueTransfer.replacer(result);

    return this.result.serialize(payload);
  }

  deserializeResult<T = any>(buffer: Uint8Array): T {
    const payload = this.result.deserialize(buffer) as ISerializableResult;

    if (payload.$) {
      return ReturnValueTransfer.reviver(payload.$);
    }

    return payload.r;
  }
}

class AnyProtocolProcessor implements IProtocolProcessor {
  serializeRequest(args: any[]): Uint8Array {
    return anySerializer.serialize(args);
  }

  deserializeRequest(buffer: Uint8Array): any[] {
    return anySerializer.deserialize(buffer);
  }

  serializeResult<T = any>(result: T): Uint8Array {
    return anySerializer.serialize(result);
  }

  deserializeResult<T = any>(buffer: Uint8Array): T {
    return anySerializer.deserialize(buffer);
  }
}

export class ProtocolRepository {
  fury = new Fury();

  private processorMap = new Map<string, SumiProtocolProcessor>();

  private anyProcessor = new AnyProtocolProcessor();

  has(name: string) {
    return this.processorMap.has(name);
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
    this.processorMap.set(methodProtocol.method, new SumiProtocolProcessor(methodProtocol, this.fury));
  }

  getProcessor(method: string): IProtocolProcessor {
    const processor = this.processorMap.get(method);
    if (processor) {
      return processor;
    }
    return this.anyProcessor;
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
