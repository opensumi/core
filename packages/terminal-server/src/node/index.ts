import {WebSocketHandler} from '@ali/ide-connection';
import {PtyService, pty} from './pty';
import * as ws from 'ws';
import * as pathMatch from 'path-match';
const route = pathMatch();
import * as path from 'path';

export class TerminalHandler extends WebSocketHandler {
  public handlerId = 'terminal';

  private dataWS;
  private dataRoute = route(`/terminal/data/connect/:record_id`);

  private terminalWS;
  private terminalRoute = route(`/terminal/connect/:record_id`);

  private connectionMap: Map<string, any> = new Map();
  private connectionTerminalMap: Map<string, pty.IPty> = new Map();
  private connectionTerminalLogMap: Map<string, string> = new Map();
  public ptyService = new PtyService();

  constructor(private logger: any = console) {
    super();
  }
  init() {
    this.logger.log('init Terminal Server');
    this.initServer();
  }
  private initServer() {
    this.initDataWS();
    this.initTerminalWS();
    this.pingClients();
  }
  private pingClients() {
    function noop() {}
    setInterval(() => {
      this.dataWS.clients.forEach(function each(ws) {
        ws.ping(noop);
      });
      this.terminalWS.clients.forEach(function each(ws) {
        ws.ping(noop);
      });
    }, 5000);
  }
  private initDataWS() {
    this.dataWS = new ws.Server({noServer: true});
    const connectionTerminalMap = this.connectionTerminalMap;
    const connectionTerminalLogMap = this.connectionTerminalLogMap;
    const connectionMap = this.connectionMap;

    this.dataWS.on('connection', (connection) => {
      const {record_id} = connection.routeParam;
      const connectionTerminalInitialLog = connectionTerminalLogMap.get(record_id);
      const connectionTerminal = connectionTerminalMap.get(record_id);

      connection.send(connectionTerminalInitialLog);

      if (connectionTerminal) {
        connectionTerminal.on('data', (data) => {
          try {
            connection.send(data);
          } catch (e) {
            this.logger.log(e);
          }
        });
        connection.on('pong', () => {
          // this.logger.log('dataWS pong');
        });

        connection.on('message', (msg) => {
          connectionTerminal.write(msg);
        });
        connection.on('close', () => {
          connectionTerminal.kill();

          connectionTerminalMap.delete(record_id);
          connectionTerminalLogMap.delete(record_id);
          connectionMap.delete(record_id);
        });
        connection.on('error', (e) => {
          this.logger.log('connection error');
          this.logger.log(e);
        });
      }

    });
  }
  private initTerminalWS() {
    this.terminalWS = new ws.Server({noServer: true});
    const connectionMap = this.connectionMap;
    const connectionTerminalMap = this.connectionTerminalMap;
    const connectionTerminalLogMap = this.connectionTerminalLogMap;

    this.terminalWS.on('connection', (connection) => {
      const {record_id} = connection.routeParam;
      connectionMap.set(record_id, connection);

      connection.on('pong', () => {
        // this.logger.log('terminalWS pong');
      });

      connection.on('message', (message) => {
        try {
          message = JSON.parse(message);
        } catch (e) {
          this.logger.log(e);
          return;
        }

        const {action, payload} = message;
        if (action === 'create') {
          const terminal = this.ptyService.create(
            payload.rows,
            payload.cols,
            payload.cwd,
          );
          // this.logger.log('create action record_id', record_id);
          connectionTerminalMap.set(record_id, terminal);
          connectionTerminalLogMap.set(record_id, '');

          terminal.on('data', (data) => {
            connectionTerminalLogMap.set(record_id, connectionTerminalLogMap.get(record_id) + data);
          });

          connection.send(JSON.stringify({action: 'create', record_id}));
        } else if (action === 'resize') {
          const terminal = connectionTerminalMap.get(record_id);
          if (terminal) {
            const resizeResult = this.ptyService.resize(terminal, payload.rows, payload.cols);
            connection.send(JSON.stringify({action: 'resize', result: resizeResult}));
          }
        }

      });
    });
  }
  handleUpgrade(wsPathName: string, request, socket, head): boolean {
    const dataRouteResult = this.dataRoute(wsPathName);
    const terminalRouteResult = this.terminalRoute(wsPathName);

    if (dataRouteResult) {
      const dataWS = this.dataWS;
      dataWS.handleUpgrade(request, socket, head, (connection) => {
        connection.routeParam = {
          record_id: dataRouteResult.record_id,
          wsPathName,
        };

        dataWS.emit('connection', connection);
      });
      return true;
    }

    if (terminalRouteResult) {
      const terminalWS = this.terminalWS;
      terminalWS.handleUpgrade(request, socket, head, (connection) => {
        connection.routeParam = {
          record_id: terminalRouteResult.record_id,
          wsPathName,
        };

        terminalWS.emit('connection', connection);
      });
      return true;
    }

    return false;
  }
}
