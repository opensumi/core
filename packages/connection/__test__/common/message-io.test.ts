import { MessageIO, RPCResponseMessage } from '@opensumi/ide-connection/lib/common/rpc';

import { protocols } from './rpc/utils';

describe('message io', () => {
  it('should be able to create a request', () => {
    const repo = new MessageIO();
    repo.loadProtocolMethod(protocols.add.protocol);

    const buf = repo.Request(0, protocols.add.protocol.method, {}, [1, 2]);
    expect(buf.byteLength).toBeGreaterThan(20);

    repo.reader.reset(buf);
    // version + op type + id
    repo.reader.skip(1 + 1 + 4);
    // method
    const method = repo.reader.stringOfVarUInt32();
    expect(method).toBe(protocols.add.protocol.method);

    // headers
    const result = repo.requestHeadersSerializer.read();
    expect(result).toEqual({ cancelable: null });
    // args
    const args = repo.getProcessor(protocols.add.protocol.method).readRequest();
    expect(args).toEqual([1, 2]);
  });
  it('should be able to create a response', () => {
    const io = new MessageIO();
    io.loadProtocolMethod(protocols.add.protocol);
    const buf = io.Response(0, protocols.add.protocol.method, {}, 3);
    expect(buf.byteLength).toBeGreaterThan(20);

    const response = io.parse(buf) as RPCResponseMessage;

    const { method, headers, result } = response;

    expect(method).toBe(protocols.add.protocol.method);
    expect(headers).toEqual({
      chunked: null,
    });
    expect(result).toEqual(3);

    const buf2 = io.Response(0, 'any1', {}, null);
    expect(buf2.byteLength).toBeGreaterThan(20);

    const buf3 = io.Response(0, 'any2', {}, new Uint8Array(10));
    expect(buf3.byteLength).toBeGreaterThan(20);
  });
});
