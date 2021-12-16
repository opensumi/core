export const defaultCss = `body {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-weight: var(--vscode-font-weight);
  font-size: var(--vscode-font-size);
  margin: 0;
  padding: 0 20px;
}

img {
  max-width: 100%;
  max-height: 100%;
}

a {
  color: var(--vscode-textLink-foreground);
}

a:hover {
  color: var(--vscode-textLink-activeForeground);
}

a:focus,
input:focus,
select:focus,
textarea:focus {
  outline: 1px solid -webkit-focus-ring-color;
  outline-offset: -1px;
}

code {
  color: var(--vscode-textPreformat-foreground);
}

blockquote {
  background: var(--vscode-textBlockQuote-background);
  border-color: var(--vscode-textBlockQuote-border);
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background-color: var(--vscode-scrollbarSlider-background);
}
::-webkit-scrollbar-thumb:hover {
  background-color: var(--vscode-scrollbarSlider-hoverBackground);
}
::-webkit-scrollbar-thumb:active {
  background-color: var(--vscode-scrollbarSlider-activeBackground);
}`;

export interface IWebviewChannel {
  postMessage: (channel: string, data?: any) => void;
  onMessage: (channel: string, handler: any) => void;
  focusIframeOnCreate?: boolean;
  ready?: Promise<void>;
  onIframeLoaded?: (iframe: HTMLIFrameElement) => void;
  fakeLoad: boolean;
}

function addslashes(str) {
  // eslint-disable-next-line no-control-regex
  return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

export function getVsCodeApiScript(state) {
  return `
    const acquireVsCodeApi = (function() {
      const originalPostMessage = window.parent.postMessage.bind(window.parent);
      const targetOrigin = '*';
      let acquired = false;

      let state = ${state ? `JSON.parse("${addslashes(JSON.stringify(state))}")` : undefined};

      return () => {
        if (acquired) {
          throw new Error('An instance of the VS Code API has already been acquired');
        }
        acquired = true;
        return Object.freeze({
          postMessage: function(msg) {
            return originalPostMessage({ command: 'onmessage', data: msg }, targetOrigin);
          },
          setState: function(newState) {
            state = newState;
            originalPostMessage({ command: 'do-update-state', data: JSON.parse(JSON.stringify(newState)) }, targetOrigin);
            return newState;
          },
          getState: function() {
            return state;
          }
        });
      };
    })();
    delete window.parent;
    delete window.top;
    delete window.frameElement;
    window.acquireVsCodeApi = acquireVsCodeApi;
  `;
}
