import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';

import { ICodeEditor, IDiffEditor } from '@opensumi/ide-monaco';

export interface Size {
  width?: number;
  height?: number;
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;

  return ref;
}

export default useLatest;
export function useSize(fn: () => void, ref: React.ForwardedRef<HTMLDivElement>): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const callback = useLatest((size: Size) => {
    fn();
  });
  useLayoutEffect(() => {
    if (typeof ref !== 'object') {
      return () => {};
    }
    const el = ref?.current;
    if (!el || !fn) {
      return () => {};
    }
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        callback.current({
          width: entry.target.clientWidth,
          height: entry.target.clientHeight,
        });
      });
    });

    resizeObserver.observe(el as HTMLElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [callback, ref, fn]);
}

const setEditorHeight = (
  editor: ICodeEditor | undefined,
  editorTarget: HTMLDivElement,
  editorContainer: HTMLDivElement,
) => {
  if (!editor) {
    return;
  }
  const curLenght = editor.getModel()?.getLineCount() || 1;
  const diffItemHeight = `${curLenght * 20 + 16 + 12 + 22}px`;
  const _height = `${curLenght * 20}px`;
  if (editorTarget.style.height !== _height) {
    editorTarget.style.height = _height;
    editorContainer.style.height = diffItemHeight;
    editor.layout();
  }
};

const setDiffEditorHeight = (
  editor: IDiffEditor | undefined,
  editorTarget: HTMLDivElement,
  editorContainer: HTMLDivElement,
) => {
  const originalLineCount = editor?.getModel()?.original.getLineCount() || 0;

  editor?.onDidUpdateDiff(() => {
    let finalLineCount = originalLineCount;
    for (const change of editor?.getLineChanges() || []) {
      if (!change.originalEndLineNumber) {
        finalLineCount += change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
      } else if (
        change.originalStartLineNumber === change.modifiedStartLineNumber &&
        change.modifiedEndLineNumber > change.originalEndLineNumber
      ) {
        finalLineCount += change.modifiedEndLineNumber - change.originalEndLineNumber;
      }
    }
    editorTarget.style.height = `${finalLineCount * 20 + 12}px`;
    editorContainer.style.height = `${finalLineCount * 20 + 16 + 12 + 22}px`;
    editor.layout();
  });
};

export function useEditorLayout(
  editor: ICodeEditor | IDiffEditor | undefined,
  editorTargetRef: React.RefObject<HTMLDivElement>,
  editorContainerRef: React.RefObject<HTMLDivElement>,
) {
  const editorTarget = editorTargetRef.current;
  const editorContainer = editorContainerRef.current;

  const editorLaylout = useCallback(() => {
    if (editor) {
      editor.layout();
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      if (!editorTarget || !editorContainer) {
        return;
      }
      if ((editor as IDiffEditor).renderSideBySide !== undefined) {
        setDiffEditorHeight(editor as IDiffEditor, editorTarget, editorContainer);
      } else {
        setEditorHeight(editor as ICodeEditor, editorTarget, editorContainer);
      }
    }
    window.addEventListener('resize', editorLaylout);
    return () => {
      window.removeEventListener('resize', editorLaylout);
    };
  }, [editor, editorLaylout]);

  useSize(editorLaylout, editorContainerRef);
}
