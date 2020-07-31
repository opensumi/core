const reactEvents = ['onAbort', 'onAnimationCancel', 'onAnimationEnd', 'onAnimationIteration', 'onAuxClick', 'onBlur',
  'onChange', 'onClick', 'onClose', 'onContextMenu', 'onDoubleClick', 'onError', 'onFocus', 'onGotPointerCapture',
  'onInput', 'onKeyDown', 'onKeyPress', 'onKeyUp', 'onLoad', 'onLoadEnd', 'onLoadStart', 'onLostPointerCapture',
  'onMouseDown', 'onMouseMove', 'onMouseOut', 'onMouseOver', 'onMouseUp', 'onPointerCancel', 'onPointerDown',
  'onPointerEnter', 'onPointerLeave', 'onPointerMove', 'onPointerOut', 'onPointerOver', 'onPointerUp', 'onReset',
  'onResize', 'onScroll', 'onSelect', 'onSelectionChange', 'onSelectStart', 'onSubmit', 'onTouchCancel',
  'onTouchMove', 'onTouchStart', 'onTouchEnd', 'onTransitionCancel', 'onTransitionEnd', 'onDrag', 'onDragEnd',
  'onDragEnter', 'onDragExit', 'onDragLeave', 'onDragOver', 'onDragStart', 'onDrop', 'onFocusOut'];

const divergentNativeEvents = {
  onDoubleClick: 'dblclick',
};

const mimickedReactEvents = {
  onInput: 'onChange',
  onFocusOut: 'onBlur',
  onSelectionChange: 'onSelect',
};

export function retargetEvents(shadowRoot: ShadowRoot) {
  const removeEventListeners: Array<() => void> = [];

  reactEvents.forEach((reactEventName) => {

    const nativeEventName = getNativeEventName(reactEventName);

    function retargetEvent(event) {

      event.nativeEvent = event;
      const path = event.path || (event.composedPath && event.composedPath()) || composedPath(event.target);

      for (const el of path) {
        let props = null;
        const reactComponent = findReactComponent(el);
        const eventHandlers = findReactEventHandlers(el);

        if (!eventHandlers) {
          props = findReactProps(reactComponent);
        } else {
          props = eventHandlers;
        }

        if (reactComponent && props) {
          dispatchEvent(event, reactEventName, props);
        }

        if (reactComponent && props && mimickedReactEvents[reactEventName]) {
          dispatchEvent(event, mimickedReactEvents[reactEventName], props);
        }

        if (event.cancelBubble) {
          break;
        }

        if (el === shadowRoot) {
          break;
        }
      }
    }

    shadowRoot.addEventListener(nativeEventName, retargetEvent, false);

    removeEventListeners.push(() => {
      shadowRoot.removeEventListener(nativeEventName, retargetEvent, false);
    });
  });

  return () => {

    removeEventListeners.forEach((removeEventListener) => {
      removeEventListener();
    });
  };
}

function findReactEventHandlers(item) {
  return findReactProperty(item, '__reactEventHandlers');
}

function findReactComponent(item) {
  return findReactProperty(item, '_reactInternal');
}

function findReactProperty(item, propertyPrefix) {
  for (const key in item) {
    if (item.hasOwnProperty(key) && key.indexOf(propertyPrefix) !== -1) {
      return item[key];
    }
  }
}

function findReactProps(component) {
  if (!component) { return undefined; }
  if (component.memoizedProps) { return component.memoizedProps; } // React 16 Fiber
  if (component._currentElement && component._currentElement.props) { return component._currentElement.props; } // React <=15
}

function dispatchEvent(event, eventType, componentProps) {
  event.persist = () => {
    event.isPersistent = () => true;
  };

  if (componentProps[eventType]) {
    componentProps[eventType](event);
  }
}

function getNativeEventName(reactEventName) {
  if (divergentNativeEvents[reactEventName]) {
    return divergentNativeEvents[reactEventName];
  }
  return reactEventName.replace(/^on/, '').toLowerCase();
}

function composedPath(el: HTMLElement) {
  const path: Array<Element | Document | Window> = [];
  while (el) {
    path.push(el);
    if (el.tagName === 'HTML') {
      path.push(document);
      path.push(window);
      return path;
    }
    el = el.parentElement!;
  }
}
