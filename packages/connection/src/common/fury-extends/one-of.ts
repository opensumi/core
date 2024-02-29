import { ObjectTypeDescription, Serializer, TypeDescription } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';

import { furyFactory } from './shared';
const { fury, reader, writer } = furyFactory();

type Writable = Record<string, any> & { kind: string };

export const oneOf = (schemas: TypeDescription[]) => {
  const serializers = [] as Serializer[];

  const indexToKind = {} as Record<number, string>;
  const kindToIndex = {} as Record<string, number>;

  schemas.forEach((schema, i) => {
    const kind = (schema as ObjectTypeDescription).options.tag;
    serializers.push(generateSerializer(fury, schema));
    indexToKind[i] = kind;
    kindToIndex[kind] = i;
  });

  const deserialize = (bytes: Uint8Array) => {
    reader.reset(bytes);
    const idx = reader.uint8();
    const serializer = serializers[idx];
    const v = serializer.read();
    v.kind = indexToKind[idx];
    return v;
  };

  const serialize = (v: Writable) => {
    const index = kindToIndex[v.kind];
    const serializer = serializers[index];

    writer.reset();
    writer.uint8(index);
    serializer.write(v);

    return writer.dump();
  };

  return {
    deserialize,
    serialize,
  };
};
