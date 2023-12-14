import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

export enum ContentCodec {
  Text = 1,
  Binary = 2,
}

export const reader = BinaryReader({});
const writer = BinaryWriter({});

export function createTextPacket(content: string) {
  writer.reset();
  writer.uint8(ContentCodec.Text);
  writer.stringOfVarInt32(content);
  return writer.dump();
}

export function createBinaryPacket(content: Uint8Array) {
  writer.reset();
  writer.uint8(ContentCodec.Binary);
  writer.varInt32(content.byteLength);
  writer.buffer(content);
  return writer.dump();
}
