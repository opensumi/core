import {Emitter} from '@ali/ide-core-common';
import * as net from 'net';
import {
  createSocketConnection,
  RPCServiceCenter,
  initRPCService,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';
import {extServerListenPath} from './index';

console.log('fork ext process');

function initRPCProtocol() {
  const extCenter = new RPCServiceCenter();
  const {getRPCService, createRPCService} = initRPCService(extCenter);
  const extConnection = net.createConnection(extServerListenPath);
  extCenter.setConnection(createSocketConnection(extConnection));

  const service = getRPCService('ExtProtocol');
  const onMessageEmitter = new Emitter<string>();
  service.on('onMessage', (msg) => {
    onMessageEmitter.fire(msg);
  });
  const onMessage = onMessageEmitter.event;
  const send = service.onMessage;

  const extProtocol = new RPCProtocol({
    onMessage,
    send,
  });

  // TODO: require inceptor
  // TODO: $loadPlugin
  // TODO: $activate

  // TODO: 测试代码
  setTimeout(async () => {
    const commandIdentifier = new ProxyIdentifier( 'CommandRegistry');
    const proxy = extProtocol.getProxy(commandIdentifier);

    const result = await proxy.$getCommands();
    console.log('ext protocol result', result);
  });
}

initRPCProtocol();
