import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import Ansi from '../../src/common/ansi';
const Anser = require('anser');

describe('Ansi component Test Suites', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('id', 'app');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  function $$(selector: string) {
    return document.querySelector(selector);
  }

  it('should render ansi component', () => {
    const input = `\x1B[" + fg + "m " + fg + " \x1B[0m`;
    act(() => {
      ReactDOM.render(
        <Ansi className={'test-ansi'} linkify={false}>{input}</Ansi>,
        container,
      );
    });
    const output = Anser.ansiToJson(input, { json: true, remove_empty: true, use_classes: false });
    expect($$('.test-ansi')?.textContent).toBe(output[0].content);
  });

  it('should render ansi component and contains file path', (done) => {
    const input = `\x1B[ fg + /path/to/file.js fg \x1B[0m`;
    const onPath = (linkPath: string) => {
      expect(linkPath).toBe('/path/to/file.js');
      done();
    };
    act(() => {
      ReactDOM.render(
        <Ansi className={'test-ansi-link'} onPath={onPath} linkify>{input}</Ansi>,
        container,
      );
    });
    const output = Anser.ansiToJson(input, { json: true, remove_empty: true, use_classes: false });
    expect($$('.test-ansi-link')?.textContent).toBe(output[0].content);
    expect($$('.test-ansi-link > span > a')).toBeDefined();
    Simulate.click($$('.test-ansi-link > span > a')!);
  });

  it('should render ansi component and contains link', (done) => {
    const input = `\x1B[ fg + http://www.work-alibaba-inc.com + fg \x1B[0m`;
    act(() => {
      ReactDOM.render(
        <Ansi className={'test-ansi-link'} linkify>{input}</Ansi>,
        container,
      );
    });
    const output = Anser.ansiToJson(input, { json: true, remove_empty: true, use_classes: false });
    expect($$('.test-ansi-link')?.textContent).toBe(output[0].content);
    expect($$('.test-ansi-link > span > a')).toBeDefined();
    expect($$('.test-ansi-link > span > a')?.textContent).toBe('http://www.work-alibaba-inc.com');
    done();
  });

  it('should render ansi component with classname', () => {
    const input = `\x1B[" + attr + ";" + fg + "m " + fg + "  \x1B[0m`;
    act(() => {
      ReactDOM.render(
        <Ansi useClasses className={'test-ansi-link'} linkify={true}>{input}</Ansi>,
        container,
      );
    });
    const output = Anser.ansiToJson(input, { json: true, remove_empty: true, use_classes: true });
    expect($$('.test-ansi-link')?.textContent).toBe(output[0].content);
  });
});
