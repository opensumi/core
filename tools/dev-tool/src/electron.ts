import * as http from 'http';
import { app, BrowserWindow } from 'electron';
import { createServerConnection } from '@ali/ide-core-node';
import { TerminalHandler } from '@ali/ide-terminal-server';
import { getLogger } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';

let singleton: BrowserWindow;

function createWindow() {
  if (!singleton) {
    singleton = new BrowserWindow({
      show: false,
    });

    singleton.maximize();
    singleton.loadURL('http://localhost:8080');

    singleton.on('ready-to-show', () => {
      singleton.show();
    });
  }
  return singleton;
}

export function startElectron(modules: any[]) {
  app.on('ready', () => {
    const logger = getLogger();
    const injector = new Injector();
    const server = http.createServer().listen(8000);
    const terminalHandler = new TerminalHandler(logger);
    createServerConnection(injector, modules, server, [
      terminalHandler,
    ]);

    createWindow();
  });

  app.on('quit', () => {
    // TODO
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
