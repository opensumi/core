import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockAcpTurnEditor = jest.fn((props: any) => {
  React.useEffect(() => {
    props.onInputHandleReady?.({ focus: jest.fn() });
    return () => props.onInputHandleReady?.(null);
  }, [props.onInputHandleReady]);

  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      {
        'data-testid': 'queued-editor-save',
        onClick: () =>
          props.onSend(
            '{{@file:/workspace/editor.js}} edited',
            ['data:image/png;base64,edited'],
            'edited-agent',
            '/review',
          ),
        type: 'button',
      },
      'save',
    ),
    React.createElement(
      'button',
      {
        'data-testid': 'queued-editor-cancel',
        onClick: props.onCancelEdit,
        type: 'button',
      },
      'cancel',
    ),
    React.createElement(
      'button',
      {
        'data-testid': 'queued-editor-immediate',
        onClick: () =>
          props.onImmediateSend({
            message: '{{@folder:/workspace}} now',
            images: ['data:image/png;base64,now'],
            agentId: 'now-agent',
            command: '/now',
          }),
        type: 'button',
      },
      'immediate',
    ),
  );
});

jest.mock('@opensumi/ide-core-browser', () => ({
  AppConfig: Symbol('AppConfig'),
  useInjectable: jest.fn(() => ({ workspaceDir: '/workspace/root' })),
}));

jest.mock('../../src/browser/acp/components/AcpTurnEditor', () => ({
  AcpTurnEditor: (props: any) => mockAcpTurnEditor(props),
}));

import { AcpQueuedTurnEditor } from '../../src/browser/acp/components/AcpQueuedTurnEditor';

describe('AcpQueuedTurnEditor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it('keeps queued draft state local and does not receive the main mutable context service', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const onImmediateSend = jest.fn();
    const onReady = jest.fn();
    const turn = {
      id: 'turn-1',
      message: '{{@file:/workspace/original.ts}} review',
      images: ['data:image/png;base64,queued'],
      agentId: 'queued-agent',
      command: '/queued',
    };

    act(() => {
      root.render(
        <AcpQueuedTurnEditor
          turn={turn}
          onSave={onSave}
          onCancel={onCancel}
          onImmediateSend={onImmediateSend}
          onReady={onReady}
        />,
      );
    });

    const editorProps = mockAcpTurnEditor.mock.calls[0][0];
    expect(editorProps).toEqual(
      expect.objectContaining({
        variant: 'queued',
        initialDraft: turn,
        agentId: 'queued-agent',
        command: '/queued',
        theme: null,
        agentCwd: '/workspace/root',
      }),
    );
    expect(editorProps.contextService).toBeUndefined();

    act(() => {
      (container.querySelector('[data-testid="queued-editor-save"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="queued-editor-cancel"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="queued-editor-immediate"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledWith({
      message: '{{@file:/workspace/editor.js}} edited',
      images: ['data:image/png;base64,edited'],
      agentId: 'edited-agent',
      command: '/review',
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onImmediateSend).toHaveBeenCalledWith({
      message: '{{@folder:/workspace}} now',
      images: ['data:image/png;base64,now'],
      agentId: 'now-agent',
      command: '/now',
    });
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ focus: expect.any(Function) }));
  });
});
