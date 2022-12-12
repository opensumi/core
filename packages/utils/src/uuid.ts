// @ts-ignore
import { nanoid } from 'nanoid';

export function uuid(size?: number): string {
  return nanoid(size);
}
