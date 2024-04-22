import { extractServiceAndMethod, getRPCName } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';

describe('Multiplexer', () => {
  it('can construct rpc name', () => {
    const rpcId = '@opensumi/runner';
    const method = '$fetch';

    const name = getRPCName(rpcId, method);
    const [serviceId, methodName] = extractServiceAndMethod(name);

    expect(serviceId).toBe(rpcId);
    expect(methodName).toBe(method);
  });
});
