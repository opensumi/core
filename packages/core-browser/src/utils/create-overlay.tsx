import React from 'react';
import ReactDOM from 'react-dom';

export const destroyFns: Array<() => void> = [];

export function destroyAllOverlays() {
  while (destroyFns.length) {
    const close = destroyFns.pop();
    if (close) {
      close();
    }
  }
}

export function createOverlay(children: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);

  function destroy() {
    const unmountResult = ReactDOM.unmountComponentAtNode(div);
    if (unmountResult && div.parentNode) {
      div.parentNode.removeChild(div);
    }
    for (let i = 0; i < destroyFns.length; i++) {
      const fn = destroyFns[i];
      if (fn === close) {
        destroyFns.splice(i, 1);
        break;
      }
    }
  }

  function render(comp: React.ReactElement) {
    ReactDOM.render(React.cloneElement(comp), div);
  }

  function update(newChildren: React.ReactElement) {
    render(newChildren);
  }

  function close() {
    destroy();
  }

  render(children);

  destroyFns.push(close);

  return {
    destroy: close,
    update,
  };
}
