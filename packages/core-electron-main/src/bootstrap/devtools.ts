import { ipcMain, BrowserWindow } from 'electron';

export const initForDevtools = (mainWindow: BrowserWindow) => {
  // `mainWindow.webContents.send` is used to transfer messages to main window
  // wherer ipcRenderer.on('main->browser', xxx) is set to receive the messages
  // then put them to window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.ipcMessages

  // ipcMain.on
  const originalIpcMainOn = ipcMain.on;
  ipcMain.on = (channel: any, handler: any) => {
    const proxyHandler = (event: any, ...args: any) => {
      mainWindow.webContents.send('main->browser', { ipcMethod: 'ipcMain.on', channel, args });
      handler(event, ...args);
      // TODO event.returnValue会作为ipcRenderer.sendSync的response, 可捕获
    };
    return originalIpcMainOn.call(ipcMain, channel, proxyHandler);
  };

  // ipcMain.handle
  const originalIpcMainHandle = ipcMain.handle;
  ipcMain.handle = (channel: any, handler: any) => {
    const proxyHandler = (event: any, ...args: any) => {
      mainWindow.webContents.send('main->browser', { ipcMethod: 'ipcMain.handle', channel, args });
      handler(event, ...args);
      // TODO ipcMain.handle的返回值会作为ipcRenderer.invoke的response, 可捕获
    };
    return originalIpcMainHandle.call(ipcMain, channel, proxyHandler);
  };

  // TODO BrowserWindow.webContents.send
  // 这是main进程向renderer进程发送消息的方式, 但BrowserWindow可以是任何实例,
  // 所以我不知道怎么处理. 如果可以实现, 注意判断channel是否为'main->browser'
};
