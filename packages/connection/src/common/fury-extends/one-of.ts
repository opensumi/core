import { ObjectTypeDescription, Serializer, TypeDescription } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';

import { FuryFactoryReturn, furyFactory } from './shared';

type Writable = Record<string, any> & { kind: string };

const cap = 8;

export const oneOf = (
  schemas: [
    TypeDescription,
    TypeDescription,
    TypeDescription,
    TypeDescription,
    TypeDescription,
    TypeDescription,
    TypeDescription,
    TypeDescription,
  ],
  context?: FuryFactoryReturn,
) => {
  if (!context) {
    context = furyFactory();
  }

  const { fury, reader, writer } = context;

  const serializers = new Array(cap) as Serializer[];
  const kinds = new Array(cap) as string[];

  const kindToIndex = {} as Record<string, number>;

  schemas.forEach((schema, i) => {
    const kind = (schema as ObjectTypeDescription).options.tag;
    serializers[i] = generateSerializer(fury, schema);
    kinds[i] = kind;
    kindToIndex[kind] = i;
  });

  const deserialize = (bytes: Uint8Array) => {
    reader.reset(bytes);
    const idx = reader.uint8();

    let v: any;
    switch (idx) {
      case 0:
        v = serializers[0].read();
        break;
      case 1:
        v = serializers[1].read();
        break;
      case 2:
        v = serializers[2].read();
        break;
      case 3:
        v = serializers[3].read();
        break;
      case 4:
        v = serializers[4].read();
        break;
      case 5:
        v = serializers[5].read();
        break;
      case 6:
        v = serializers[6].read();
        break;
      case 7:
        v = serializers[7].read();
        break;
      default: {
        throw new Error('unknown index: ' + idx);
      }
    }

    v.kind = kinds[idx];
    return v;
  };

  const serialize = (v: Writable) => {
    const index = kindToIndex[v.kind];

    writer.reset();

    writer.uint8(index);

    switch (index) {
      case 0:
        serializers[0].write(v);
        break;
      case 1:
        serializers[1].write(v);
        break;
      case 2:
        serializers[2].write(v);
        break;
      case 3:
        serializers[3].write(v);
        break;
      case 4:
        serializers[4].write(v);
        break;
      case 5:
        serializers[5].write(v);
        break;
      case 6:
        serializers[6].write(v);
        break;
      case 7:
        serializers[7].write(v);
        break;
    }

    return writer.dump();
  };

  return {
    deserialize,
    serialize,
  };
};
