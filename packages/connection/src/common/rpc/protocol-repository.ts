import Fury, { Type, TypeDescription } from '@furyjs/fury';

import { anySerializer } from '../fury-extends/any';

import { TSumiProtocol, TSumiProtocolMethod } from './types';

export type TRequestTransferable = ITransferable[];

export interface ITransferable {
  /**
   * transfer raw value
   */
  r: any;

  /**
   * value that cannot be transferred, use string instead
   */
  $?: string;
}

type TSerializer = ReturnType<Fury['registerSerializer']>;

interface IProtocolProcessor {
  serializeRequest(args: any[]): Uint8Array;
  deserializeRequest(buffer: Uint8Array): any[];
  serializeResult<T = any>(result: T): Uint8Array;
  deserializeResult<T = any>(buffer: Uint8Array): T;
}

const createTransferable = (name: string, type?: TypeDescription) => {
  const props = {
    $: Type.string(),
  } as Record<string, TypeDescription>;
  if (type) {
    props.r = type;
  }
  return Type.object(name, props);
};

class SumiProtocolProcessor implements IProtocolProcessor {
  request: TSerializer;
  result: TSerializer;
  requestArgsLength: number;

  constructor(methodProtocol: TSumiProtocolMethod, public fury: Fury) {
    const methodName = methodProtocol.method;

    const argsTuple = [] as TypeDescription[];

    for (const element of methodProtocol.request) {
      argsTuple.push(createTransferable(methodName + '^' + element.name, element.type));
    }

    const requestProto = Type.tuple(argsTuple);
    const resultProto = createTransferable(methodName + 'v', methodProtocol.response.type);

    this.requestArgsLength = argsTuple.length;

    this.request = this.fury.registerSerializer(requestProto);
    this.result = this.fury.registerSerializer(resultProto);
  }

  serializeRequest(args: any[]): Uint8Array {
    const newArray: TRequestTransferable = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = ObjectTransfer.replacer(args[i]);
    }

    return this.request.serialize(newArray);
  }

  deserializeRequest(buffer: Uint8Array): any[] {
    const result = new Array(this.requestArgsLength);
    const argsArray = this.request.deserialize(buffer) as TRequestTransferable;
    for (let i = 0; i < this.requestArgsLength; i++) {
      result[i] = ObjectTransfer.reviver(argsArray[i]);
    }
    return result;
  }

  serializeResult<T = any>(result: T): Uint8Array {
    return this.result.serialize(ObjectTransfer.replacer(result));
  }

  deserializeResult<T = any>(buffer: Uint8Array): T {
    const payload = this.result.deserialize(buffer) as ITransferable;
    return ObjectTransfer.reviver(payload);
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

class ObjectTransfer {
  static TypeUndefined = '$undefined';

  static replacer(value: any) {
    const payload = {} as ITransferable;

    if (typeof value === 'undefined') {
      payload.$ = ObjectTransfer.TypeUndefined;
    }

    if (!payload.$) {
      payload.r = value;
    }

    return payload;
  }

  static reviver(transferable: ITransferable): any {
    if (transferable.$ === ObjectTransfer.TypeUndefined) {
      return undefined;
    }

    return transferable.r;
  }
}
