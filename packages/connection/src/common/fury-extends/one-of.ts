import { ObjectTypeDescription, Serializer, TypeDescription } from '@furyjs/fury';
import Fury from '@furyjs/fury/dist/lib/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';

type Writable = Record<string, any> & { kind: string };

const fury = Fury({});
const reader = fury.binaryReader;
const writer = fury.binaryWriter;

export const oneOf = (schemas: TypeDescription[]) => {
  const registry = new Map<string, Serializer>();

  schemas.forEach((schema) => {
    registry.set((schema as ObjectTypeDescription).options.tag, generateSerializer(fury, schema));
  });

  const deserialize = (bytes: Uint8Array) => {
    reader.reset(bytes);
    const kind = reader.stringOfVarUInt32();
    const serializer = registry.get(kind);
    if (!serializer) {
      throw new Error(`Unknown kind: ${kind}`);
    }

    const v = serializer.read();
    v.kind = kind;

    return v;
  };

  const serializeVolatile = (v: Writable) => {
    const serializer = registry.get(v.kind);
    if (!serializer) {
      throw new Error(`Unknown kind: ${v.kind}`);
    }

    writer.reset();
    writer.stringOfVarUInt32(v.kind);
    serializer.write(v);

    return writer.dumpAndOwn();
  };

  const serialize = (v: Writable) => {
    const serializer = registry.get(v.kind);
    if (!serializer) {
      throw new Error(`Unknown kind: ${v.kind}`);
    }

    writer.reset();
    writer.stringOfVarUInt32(v.kind);
    serializer.write(v);

    return writer.dump();
  };

  return {
    deserialize,
    serialize,
    serializeVolatile,
  };
};
