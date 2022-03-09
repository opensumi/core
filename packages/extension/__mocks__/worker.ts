import * as fs from 'fs-extra';
import path from 'path';
import vm from 'vm';
const { TextDecoder, TextEncoder } = require('util');

const workerScript = `
const sumi = require('sumi');
const sayHello = () => {
  return 'hello';
}
function activate(context) {
  context.registerExtendModuleService({
    sayHello,
  })
  return { sayHello };
}
exports.activate = activate;
`;

const workerScriptWillThrowError = `
const sumi = require('sumi');
const sayHello = () => {
  throw new Error('worker runtime error.');
}
function activate(context) {
  return { sayHello };
}
exports.activate = activate;
`;

export const mockFetch = (url: string) =>
  new Promise((resolve) => {
    resolve({
      status: 200,
      text: async () => {
        if (url.includes('error')) {
          return workerScriptWillThrowError;
        }
        return workerScript;
      },
    });
  });

export class MockWorker {
  private onmessage: (msg: any, transferList?: Array<ArrayBuffer | MessagePort>) => void;

  constructor() {
    const absolutePath = path.join(__dirname, '../lib/worker-host.js');
    fs.readFile(absolutePath).then((data) => {
      const script = data.toString();
      const global = {
        Promise,
        console,
        fetch: mockFetch,
        MessageChannel,
        MessagePort,
        TextDecoder,
        TextEncoder,
        postMessage: (value: any, transferList?: Array<ArrayBuffer | MessagePort>) => {
          this.onmessage({
            data: value,
          });
        },
        navigator: {
          userAgent: 'Node.js Sandbox',
        },
        setTimeout,
        attachEvent: () => {},
        addEventListener: () => {},
      };

      const context = vm.createContext({
        ...global,
        self: global,
      });
      vm.runInContext(script, context);
    });

    this.onmessage = () => {};
  }

  postMessage(msg, transferList) {
    this.onmessage(msg, transferList);
  }
}

export class MessagePort {
  onmessage;
  onmessageerror;

  otherPort: MessagePort;
  private onmessageListeners: EventListener[] = [];

  constructor() {}

  dispatchEvent(event) {
    if (this.onmessage) {
      this.onmessage(event);
    }
    this.onmessageListeners.forEach((listener) => listener(event));
    return true;
  }

  postMessage(message) {
    if (!this.otherPort) {
      return;
    }
    this.otherPort.dispatchEvent({ data: message });
  }

  addEventListener(type, listener) {
    if (type !== 'message') {
      return;
    }
    if (typeof listener !== 'function' || this.onmessageListeners.indexOf(listener) !== -1) {
      return;
    }
    this.onmessageListeners.push(listener);
  }

  removeEventListener(type, listener) {
    if (type !== 'message') {
      return;
    }
    const index = this.onmessageListeners.indexOf(listener);
    if (index === -1) {
      return;
    }

    this.onmessageListeners.splice(index, 1);
  }
}

export class MessageChannel {
  port1: MessagePort;
  port2: MessagePort;
  constructor() {
    this.port1 = new MessagePort();
    this.port2 = new MessagePort();
    this.port1.otherPort = this.port2;
    this.port2.otherPort = this.port1;
  }
}
