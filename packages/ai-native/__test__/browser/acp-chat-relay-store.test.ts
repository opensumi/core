import { AcpChatRelayStore } from '../../src/browser/acp/acp-chat-relay-store';

describe('AcpChatRelayStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores relay digests with a generated id and expiry metadata', () => {
    const store = new AcpChatRelayStore();

    const record = store.put({
      sourceSessionId: 'acp:source',
      sourceTitle: 'Source Session',
      digestSource: 'background_summary',
      digest: 'summary',
      sourceChars: 100,
      digestChars: 7,
      sourceTruncated: false,
      ttlMs: 5000,
    });

    expect(record).toMatchObject({
      sourceSessionId: 'acp:source',
      sourceTitle: 'Source Session',
      digestSource: 'background_summary',
      digest: 'summary',
      sourceChars: 100,
      digestChars: 7,
      sourceTruncated: false,
      createdAt: 1000,
      expiresAt: 6000,
    });
    expect(record.digestId).toEqual(expect.any(String));
    expect(store.get(record.digestId)).toEqual(record);
  });

  it('drops expired records before returning them', () => {
    const store = new AcpChatRelayStore();
    const record = store.put({
      sourceSessionId: 'acp:source',
      sourceTitle: 'Source Session',
      digestSource: 'memory_summary',
      digest: 'summary',
      sourceChars: 100,
      digestChars: 7,
      sourceTruncated: false,
      ttlMs: 1000,
    });

    jest.setSystemTime(1999);
    expect(store.get(record.digestId)).toEqual(record);

    jest.setSystemTime(2000);
    expect(store.get(record.digestId)).toBeUndefined();
  });

  it('deletes relay records explicitly', () => {
    const store = new AcpChatRelayStore();
    const record = store.put({
      sourceSessionId: 'acp:source',
      sourceTitle: 'Source Session',
      digestSource: 'empty',
      digest: '',
      sourceChars: 0,
      digestChars: 0,
      sourceTruncated: false,
    });

    store.delete(record.digestId);

    expect(store.get(record.digestId)).toBeUndefined();
  });
});
