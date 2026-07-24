import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockDialog = jest.fn(() => null);

jest.mock('rc-dialog', () => ({
  __esModule: true,
  default: (props: unknown) => mockDialog(props),
}));

import Modal from '../src/modal/Modal';

describe('Modal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockDialog.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('maps the legacy wrapper class API to rc-dialog classNames without deprecated props', () => {
    act(() => {
      root.render(<Modal centered visible wrapClassName='custom-wrapper' />);
    });

    const props = mockDialog.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(props).not.toHaveProperty('wrapClassName');
    expect(props.classNames?.wrapper).toContain('kt-modal-centered');
    expect(props.classNames?.wrapper).toContain('custom-wrapper');
  });
});
