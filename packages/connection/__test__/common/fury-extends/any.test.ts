import { AnySerializer, ExtObjectTransfer } from '@opensumi/ide-connection/src/common/fury-extends/any';

import { furyFactory } from '../../../src/common/fury-extends/shared';

describe('any serializer', () => {
  it('can serialize and deserialize any type', () => {
    const obj = {
      a: 1,
      aa: 1.23412,
      b: '2',
      c: true,
      d: null,
      e: undefined,
    };

    const factory = furyFactory();
    const serializer = new AnySerializer(factory.writer, factory.reader);

    factory.writer.reset();
    serializer.write(obj);
    const buffer = factory.writer.dump();

    factory.reader.reset(buffer);
    const result = serializer.read();
    expect(result).toEqual(obj);
  });

  it('can serialize and deserialize buf', () => {
    const obj = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);

    const factory = furyFactory();
    const serializer = new AnySerializer(factory.writer, factory.reader, ExtObjectTransfer);

    factory.writer.reset();
    serializer.write(obj);
    const buffer = factory.writer.dump();

    factory.reader.reset(buffer);
    const result = Uint8Array.from(serializer.read());
    expect(result).toEqual(obj);

    const obj2 = {
      buf: obj,
    };

    factory.writer.reset();
    serializer.write(obj2);
    const buffer2 = factory.writer.dump();

    factory.reader.reset(buffer2);
    const result2 = Uint8Array.from(serializer.read().buf);
    expect(result2).toEqual(obj);
  });
});
