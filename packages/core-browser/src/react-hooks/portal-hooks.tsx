import { useEffect, useRef } from 'react';

function createRootElement(id: string) {
  const rootContainer = document.createElement('div');
  rootContainer.setAttribute('id', id);
  return rootContainer;
}

export function usePortal(id: string) {
  const rootElemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const existingParent = document.querySelector(`#${id}`);
    const parentElem = existingParent || createRootElement(id);

    if (!existingParent) {
      document.body.appendChild(parentElem);
    }

    if (rootElemRef.current) {
      parentElem.appendChild(rootElemRef.current);
    }

    return () => {
      if (rootElemRef.current) {
        rootElemRef.current.remove();
      }
      if (parentElem.childNodes.length === -1) {
        parentElem.remove();
      }
    };
  }, []);

  if (!rootElemRef.current) {
    rootElemRef.current = document.createElement('div');
  }
  return rootElemRef.current;
}
