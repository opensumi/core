/* istanbul ignore file */
const { ipcRenderer } = require('electron');

const postMessage = (message) => {
  ipcRenderer.sendToHost('webview-message', message);
}

const parent = window.parent;

window.parent = new Proxy(window.parent, {
  get: (target,p) => {
    if(p === 'postMessage') {
      return postMessage;
    } else {
      return Reflect.get(target, p);
    }
  }
})

ipcRenderer.on('webview-message', (e, data) => {
  const messageEvent = new MessageEvent('message', { data:data, source: parent});
  window.dispatchEvent(messageEvent);
})