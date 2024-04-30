// @ts-ignore
import { nanoid } from 'nanoid';

export function uuid(size?: number): string {
  return nanoid(size);
}

export function randomString(size: number, radix = 18): string {
  return Math.random()
    .toString(radix)
    .slice(2, size + 2);
}

export function makeRandomHexString(length: number): string {
  return randomString(length, 16);
}
