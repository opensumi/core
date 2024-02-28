const pool = [] as ArrayBuffer[][];
for (let i = 0; i < 64; i++) {
  pool[i] = [];
}

function log2(v: number) {
  let r: number;
  let shift: number;

  r = Number(v > 0xffff) << 4;
  v >>>= r;
  shift = Number(v > 0xff) << 3;
  v >>>= shift;
  r |= shift;
  shift = Number(v > 0xf) << 2;
  v >>>= shift;
  r |= shift;
  shift = Number(v > 0x3) << 1;
  v >>>= shift;
  r |= shift;
  return r | (v >> 1);
}

function nextPow2(v: number) {
  v += Number(v === 0);
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

export const free = (array: ArrayBufferLike | Uint8Array) => {
  if (Object.prototype.toString.call(array) !== '[object ArrayBuffer]') {
    array = (array as Uint8Array).buffer;
  }

  if (!array) {
    return;
  }

  const n = (array as Uint8Array).length || array.byteLength;
  const log_n = log2(n) | 0;
  pool[log_n].push(array);
};

function allocArrayBuffer(num: number) {
  const n = nextPow2(num);
  const log_n = log2(n);
  const d = pool[log_n];
  if (d.length > 0) {
    return d.pop()!;
  }
  return new ArrayBuffer(n);
}

export const alloc = (n: number) => new Uint8Array(allocArrayBuffer(n), 0, n);

export const clear = () => {
  for (let i = 0; i < pool.length; i++) {
    pool[i] = [];
  }
};
