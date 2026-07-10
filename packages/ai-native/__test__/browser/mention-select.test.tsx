import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-components/lib/click-outside', () => ({
  ClickOutside: ({ children }: { children: React.ReactNode }) => require('react').createElement('div', null, children),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className, iconClass }: { className?: string; iconClass?: string }) =>
    require('react').createElement('span', { className: className || iconClass }),
  getIcon: (name: string) => `icon-${name}`,
}));

import { MentionSelect } from '../../src/browser/components/mention-input/mention-select';

describe('MentionSelect', () => {
  let container: HTMLDivElement;
  let root: Root;
  let getBoundingClientRectSpy: jest.SpyInstance;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
    root = createRoot(container);

    getBoundingClientRectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function mockRect(this: HTMLElement) {
        if (this === container) {
          return { bottom: 400, height: 400, left: 0, right: 500, top: 0, width: 500 } as DOMRect;
        }
        if (this.getAttribute('role') === 'combobox') {
          return { bottom: 380, height: 20, left: 450, right: 490, top: 360, width: 40 } as DOMRect;
        }
        if (this.getAttribute('role') === 'listbox') {
          return { bottom: 360, height: 120, left: 450, right: 750, top: 240, width: 300 } as DOMRect;
        }
        return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 } as DOMRect;
      });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    getBoundingClientRectSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('right-aligns the dropdown when left alignment would overflow the clipping container', async () => {
    await act(async () => {
      root.render(
        <MentionSelect
          options={[
            { label: 'build', value: 'build', description: 'The default agent mode.' },
            { label: 'plan', value: 'plan', description: 'Plan mode.' },
          ]}
          value='build'
        />,
      );
    });

    await act(async () => {
      (container.querySelector('[role="combobox"]') as HTMLElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="combobox"]')?.className).toContain('dropdown_align_right');
  });
});
