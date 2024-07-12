import { randomBytes } from 'crypto';
import net from 'net';
import { Readable } from 'stream';
import { MessageChannel, MessagePort } from 'worker_threads';

import { Type, TypeDescription } from '@furyjs/fury';

import { ProxyJson } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { createWebSocketConnection } from '@opensumi/ide-connection/lib/common/message';
import { Deferred, isUint8Array } from '@opensumi/ide-core-common';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { NodeMessagePortConnection } from '../../../src/common/connection/drivers/node-message-port';
import { SumiConnection } from '../../../src/common/rpc/connection';
import { MessageIO } from '../../../src/common/rpc/message-io';
import { ProxySumi } from '../../../src/common/rpc-service/proxy/sumi';
import { ServiceRegistry } from '../../../src/common/rpc-service/registry';
import { createWSChannelForClient } from '../ws-channel';

function createRandomBuffer(size: number): Buffer {
  const randomContent = randomBytes(size);
  return Buffer.from(randomContent);
}

function random(length: number) {
  const numbers = '0123456789'; // 指定数字范围，
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 指定字母范围，（也可以指定字符或者小写字母）
  const total = numbers + letters;
  let result = '';

  // 从合并的字符串里随机取出一个值
  while (length > 0) {
    // 循环次数是指定长度
    length--;
    result += total[Math.floor(Math.random() * total.length)];
  }
  return result;
}

const bufferSize = 1024 * 1024;

const buffer = createRandomBuffer(bufferSize);

export const message =
  '"Hello" is a song recorded by English singer-songwriter Adele, released on 23 October 2015 by XL Recordings as the lead single from her third studio album, 25 (2015). Written by Adele and the album\'s producer, Greg Kurstin, "Hello" is a piano ballad with soul influences (including guitar and drums), and lyrics that discuss themes of nostalgia and regret. Upon release, the song garnered critical acclaim, with reviewers comparing it favourably to Adele\'s previous works and praised its lyrics, production and Adele\'s vocal performance. It was recorded in Metropolis Studios, London.';

// 1m
export const longMessage = random(1024 * 1024);
const msg200k = random(200 * 1024);

export function createConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  const connection1 = new SumiConnection(new NodeMessagePortConnection(port1));
  const connection2 = new SumiConnection(new NodeMessagePortConnection(port2));

  return {
    connection1,
    connection2,
    port1,
    port2,
    close() {
      port1.close();
      port2.close();
    },
  };
}

export async function createIPCConnectionPair() {
  const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

  const server = new net.Server();
  const deferred = new Deferred<net.Socket>();

  server.on('connection', (socket) => {
    deferred.resolve(socket);
  });

  server.listen(ipcPath);

  const socket2 = net.createConnection(ipcPath);

  return {
    connection1: new SumiConnection(new NetSocketConnection(socket2)),
    connection2: new SumiConnection(new NetSocketConnection(await deferred.promise)),
    close: (): void => {
      socket2.destroy();
      server.close();
    },
  };
}

export interface IConnectionPair {
  connection1: any;
  connection2: any;
  port1: MessagePort;
  port2: MessagePort;
  close(): void;
}

const ConnectionForMessagePort = (port: MessagePort) =>
  createWebSocketConnection({
    onMessage: (cb: any) => {
      port.on('message', cb);
    },
    send: (data: any) => {
      port.postMessage(data);
    },
  });

export function createMessagePortLegacyConnectionPair() {
  const channel = new MessageChannel();

  const { port1, port2 } = channel;

  return {
    connection1: ConnectionForMessagePort(port1),
    connection2: ConnectionForMessagePort(port2),
    port1,
    port2,
    close() {
      port1.close();
      port2.close();
    },
  };
}

export function createMessagePortWSChannel() {
  const channel = new MessageChannel();
  const { port1, port2 } = channel;

  const channel1 = createWSChannelForClient(new NodeMessagePortConnection(port1), {
    id: '1',
  });
  const channel2 = createWSChannelForClient(new NodeMessagePortConnection(port2), {
    id: '2',
  });

  return {
    channel1,
    channel2,
    close: () => {
      port1.close();
      port2.close();
    },
  };
}

const sample = {
  id: 123456,
  name: 'John Doe',
  email: 'johndoe@example.com',
  age: 30,
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zip: '98765',
  },
  phoneNumbers: [
    {
      type: 'home',
      number: '555-1234',
    },
    {
      type: 'work',
      number: '555-5678',
    },
  ],
  isMarried: true,
  hasChildren: false,
  interests: [
    'reading',
    'hiking',
    'cooking',
    'swimming',
    'painting',
    'traveling',
    'photography',
    'playing music',
    'watching movies',
    'learning new things',
    'spending time with family and friends',
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      major: 'Computer Science',
      university: 'University of California, Los Angeles',
      graduationYear: 2012,
    },
    {
      degree: 'Master of Business Administration',
      major: 'Marketing',
      university: 'Stanford University',
      graduationYear: 2016,
    },
  ],
  workExperience: [
    {
      company: 'Google',
      position: 'Software Engineer',
      startDate: '2012-06-01',
      endDate: '2014-08-31',
    },
    {
      company: 'Apple',
      position: 'Product Manager',
      startDate: '2014-09-01',
      endDate: '2018-12-31',
    },
    {
      company: 'Amazon',
      position: 'Senior Product Manager',
      startDate: '2019-01-01',
      endDate: '2018-12-31',
    },
  ],
  selfIntroduction: `Hi, my name is John Doe and I am a highly motivated and driven individual with a passion for excellence in all areas of my life. I have a diverse background and have gained valuable experience in various fields such as software engineering, product management, and marketing.
  I am a graduate of the University of California, Los Angeles where I received my Bachelor of Science degree in Computer Science. After graduation, I joined Google as a software engineer where I worked on developing innovative products that revolutionized the way people interact with technology.
  With a desire to broaden my skillset, I pursued a Master of Business Administration degree in Marketing from Stanford University. There, I gained a deep understanding of consumer behavior and developed the ability to effectively communicate complex ideas to various stakeholders.
  After completing my MBA, I joined Apple as a product manager where I led the development of several successful products and played a key role in the company's growth. Currently, I am working as a Senior Product Manager at Amazon, where I am responsible for managing a team of product managers and developing cutting-edge products that meet the needs of our customers.
  Aside from my professional life, I am an avid reader, hiker, and cook. I enjoy spending time with my family and friends, learning new things, and traveling to new places. I believe that success is a journey, not a destination, and I am committed to continuously improving myself and achieving excellence in all that I do.
  `,
};

export const data2Description = (data: any, tag: string): TypeDescription | null => {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    const item = data2Description(data[0], tag);
    if (!item) {
      throw new Error("empty array can't convert");
    }
    return {
      ...Type.array(item),
      label: 'array',
    };
  }
  if (data instanceof Date) {
    return {
      ...Type.timestamp(),
      label: 'timestamp',
    };
  }
  if (typeof data === 'string') {
    return {
      ...Type.string(),
      label: 'string',
    };
  }
  if (data instanceof Set) {
    return {
      ...Type.set(data2Description([...data.values()][0], tag)!),
      label: 'set',
    };
  }
  if (data instanceof Map) {
    return {
      ...Type.map(data2Description([...data.keys()][0], tag)!, data2Description([...data.values()][0], tag)!),
      label: 'map',
    };
  }
  if (typeof data === 'boolean') {
    return {
      ...Type.bool(),
      label: 'boolean',
    };
  }
  if (typeof data === 'number') {
    if (data > Number.MAX_SAFE_INTEGER || data < Number.MIN_SAFE_INTEGER) {
      return {
        ...Type.int64(),
        label: 'int64',
      };
    }
    return {
      ...Type.int32(),
      label: 'int32',
    };
  }

  if (typeof data === 'object') {
    if (isUint8Array(data)) {
      return Type.binary();
    }

    return Type.object(
      tag,
      Object.fromEntries(
        Object.entries(data)
          .map(([key, value]) => [key, data2Description(value, `${tag}.${key}`)])
          .filter(([_, v]) => Boolean(v)),
      ),
    );
  }

  throw new Error(`unkonw data type ${typeof data}`);
};

export const protocols = {
  shortUrl: {
    protocol: {
      method: 'shortUrl',
      request: [
        {
          name: 'url',
          type: Type.string(),
        },
      ],
      response: {
        type: Type.string(),
      },
    },
  },
  returnUndefined: {
    protocol: {
      method: 'returnUndefined',
      request: [],
      response: {
        type: Type.any(),
      },
    },
  },
  add: {
    protocol: {
      method: 'add',
      request: [
        {
          name: 'a',
          type: Type.uint32(),
        },
        {
          name: 'b',
          type: Type.uint32(),
        },
      ],
      response: {
        type: Type.uint32(),
      },
    },
  },
  getContent: {
    protocol: {
      method: 'getContent',
      request: [],
      response: {
        type: Type.binary(),
      },
    },
  },
  getSample: {
    protocol: {
      method: 'getSample',
      request: [],
      response: {
        type: data2Description(sample, 'sample') || undefined,
      },
    },
  },
};

export function createSumiRPCClientPair(pair: { connection1: SumiConnection; connection2: SumiConnection }) {
  const io = new MessageIO();

  io.loadProtocolMethod(protocols.shortUrl.protocol);
  io.loadProtocolMethod(protocols.returnUndefined.protocol);
  io.loadProtocolMethod(protocols.add.protocol);
  io.loadProtocolMethod(protocols.getContent.protocol);
  io.loadProtocolMethod(protocols.getSample.protocol);
  pair.connection1.io = io;
  pair.connection2.io = io;

  const registry = new ServiceRegistry();
  registry.registerService({
    shortUrl: (url: string) => url.slice(0, 10),
    returnUndefined: () => undefined,
  });

  const client1 = new ProxySumi(registry);

  client1.listen(pair.connection1);
  const invoker1 = client1.getInvokeProxy();

  const registry2 = new ServiceRegistry();
  registry2.registerService({
    add: (a: number, b: number) => a + b,
    getSample: () => sample,
    getContent: () => buffer,
    getMessage: () => message,
    get200kMessage: () => msg200k,
    getLongMessage: () => longMessage,
    readFileStream: (path: string) => stringToStream(message, 5),
  });

  const client2 = new ProxySumi(registry2);

  client2.listen(pair.connection2);

  const invoker2 = client2.getInvokeProxy();

  return {
    repo: io,
    client1,
    client2,
    invoker1,
    invoker2,
  };
}

export function createLegacyRPCClientPair(pair: { connection1: MessageConnection; connection2: MessageConnection }) {
  const registry = new ServiceRegistry();
  registry.registerService({
    shortUrl: (url: string) => url.slice(0, 10),
    returnUndefined: () => undefined,
  });

  const client1 = new ProxyJson(registry);
  client1.listen(pair.connection1);
  const invoker1 = client1.getInvokeProxy();

  const registry2 = new ServiceRegistry();
  registry2.registerService({
    add: (a: number, b: number) => a + b,
    getSample: () => sample,
    getContent: () => buffer,
    getMessage: () => message,
    get200kMessage: () => msg200k,
    getLongMessage: () => longMessage,
  });

  const client2 = new ProxyJson(registry2);

  client2.listen(pair.connection2);

  const invoker2 = client2.getInvokeProxy();

  return {
    client1,
    client2,
    invoker1,
    invoker2,
  };
}

function stringToStream(str: string, chunkSize = 1) {
  let index = 0;
  const stream = new Readable({
    read(size) {
      const chunk = str.slice(index, index + chunkSize);
      if (chunk) {
        this.push(chunk);
        index += chunkSize;
      } else {
        this.push(null);
      }
    },
  });

  return stream;
}
