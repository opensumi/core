/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
// Some code copued and modified from https://github.com/microsoft/vscode/blob/94c9ea46838a9a619aeafb7e8afd1170c967bb55/src/vs/workbench/contrib/debug/browser/linkDetector.ts

import * as assert from 'assert';
import { LinkDetector } from '@ali/ide-debug/lib/browser/debug-link-detector';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { IOpenerService } from '@ali/ide-core-browser';
import { isWindows } from '@ali/ide-core-browser';
import { OpenerService } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/openerService';

describe('Debug - Link Detector', () => {

  let linkDetector: LinkDetector;

  const injector = createBrowserInjector([], new MockInjector([
      {
        token: WorkbenchEditorService,
        useValue: WorkbenchEditorService,
      },
      {
        token: IFileServiceClient,
        useValue: {
          getFileStat: jest.fn((uri: string) => {
            return Promise.resolve(undefined);
          }),
        },
      },
      {
        token: IOpenerService,
        useValue: OpenerService,
      },
    ]));

  /**
   * Instantiate a {@link LinkDetector} for use by the functions being tested.
   */
  beforeAll(() => {
    linkDetector = injector.get(LinkDetector);
  });

  /**
   * Assert that a given Element is an anchor element.
   *
   * @param element The Element to verify.
   */
  function assertElementIsLink(element: Element) {
    assert(element instanceof HTMLElement);
  }

  test('noLinks', () => {
    const input = 'I am a string';
    const expectedOutput = '<span class="undefined"><span>I</span><span> </span><span>a</span><span>m</span><span> </span><span>a</span><span> </span><span>s</span><span>t</span><span>r</span><span>i</span><span>n</span><span>g</span></span>';
    const output = linkDetector.linkify(input);

    assert.strictEqual(input.length, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });

  test('trailingNewline', () => {
    const input = 'I am a string\n';
    const expectedOutput = '<span class=\"undefined\"><span>I</span><span> </span><span>a</span><span>m</span><span> </span><span>a</span><span> </span><span>s</span><span>t</span><span>r</span><span>i</span><span>n</span><span>g</span><span>\n</span></span>';
    const output = linkDetector.linkify(input);

    assert.strictEqual(input.length, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });

  test('trailingNewlineSplit', () => {
    const input = 'I am a string\n';
    const expectedOutput = '<span class=\"undefined\"><span>I</span><span> </span><span>a</span><span>m</span><span> </span><span>a</span><span> </span><span>s</span><span>t</span><span>r</span><span>i</span><span>n</span><span>g</span><span>\n</span></span>';
    const output = linkDetector.linkify(input, true);

    assert.strictEqual(input.length, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });

  test('singleLineLink', () => {
    const input = isWindows ? 'C:\\foo\\bar.js:12:34' : '/Users/foo/bar.js:12:34';
    const expectedOutput = isWindows ? '<span><a tabindex="0">C:\\foo\\bar.js:12:34<\/a><\/span>' : '<span class="undefined"><a tabindex="0"><span>/</span><span>U</span><span>s</span><span>e</span><span>r</span><span>s</span><span>/</span><span>f</span><span>o</span><span>o</span><span>/</span><span>b</span><span>a</span><span>r</span><span>.</span><span>j</span><span>s</span><span>:</span><span>1</span><span>2</span><span>:</span><span>3</span><span>4</span></a></span>';
    const output = linkDetector.linkify(input);

    assert.strictEqual(1, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('A', output.firstElementChild!.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild!);
    assert.strictEqual(isWindows ? 'C:\\foo\\bar.js:12:34' : '/Users/foo/bar.js:12:34', output.firstElementChild!.textContent);
  });

  test('relativeLink', () => {
    const input = '\./foo/bar.js';
    const expectedOutput = '<span class=\"undefined\"><span>.</span><span>/</span><span>f</span><span>o</span><span>o</span><span>/</span><span>b</span><span>a</span><span>r</span><span>.</span><span>j</span><span>s</span></span>';
    const output = linkDetector.linkify(input);

    assert.strictEqual(input.length, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });

  test('relativeLinkWithWorkspace', async () => {
    const input = '\./foo/bar.js';
    const output = linkDetector.linkify(input, false);
    assert.strictEqual('SPAN', output.tagName);
    assert.ok(output.outerHTML.indexOf('link') < 0);
  });

  test('singleLineLinkAndText', function() {
    const input = isWindows ? 'The link: C:/foo/bar.js:12:34' : 'The link: /Users/foo/bar.js:12:34';
    const expectedOutput = /^<span>The link: <a tabindex="0">.*\/foo\/bar.js:12:34<\/a><\/span>$/;
    const output = linkDetector.linkify(input);

    assert.strictEqual(11, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('SPAN', output.children[0].tagName);
    assert(!expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[0]);
    assert.strictEqual('T', output.children[0].textContent);
  });

  test('singleLineMultipleLinks', () => {
    const input = isWindows ? 'Here is a link C:/foo/bar.js:12:34 and here is another D:/boo/far.js:56:78' :
      'Here is a link /Users/foo/bar.js:12:34 and here is another /Users/boo/far.js:56:78';
    const expectedOutput = /^<span>Here is a link <a tabindex="0">.*\/foo\/bar.js:12:34<\/a> and here is another <a tabindex="0">.*\/boo\/far.js:56:78<\/a><\/span>$/;
    const output = linkDetector.linkify(input);

    assert.strictEqual(38, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('SPAN', output.children[0].tagName);
    assert.strictEqual('SPAN', output.children[1].tagName);
    assert(!expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[0]);
    assertElementIsLink(output.children[1]);
    assert.strictEqual('H', output.children[0].textContent);
    assert.strictEqual('e', output.children[1].textContent);
  });

  test('multilineNoLinks', () => {
    const input = 'Line one\nLine two\nLine three';
    const expectedOutput = /^<span><span>Line one\n<\/span><span>Line two\n<\/span><span>Line three<\/span><\/span>$/;
    const output = linkDetector.linkify(input, true);

    assert.strictEqual(3, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('SPAN', output.children[0].tagName);
    assert.strictEqual('SPAN', output.children[1].tagName);
    assert.strictEqual('SPAN', output.children[2].tagName);
    assert(!expectedOutput.test(output.outerHTML));
  });

  test('multilineTrailingNewline', () => {
    const input = 'I am a string\nAnd I am another\n';
    const expectedOutput = '<span class=\"undefined\"><span class=\"undefined\"><span>I</span><span> </span><span>a</span><span>m</span><span> </span><span>a</span><span> </span><span>s</span><span>t</span><span>r</span><span>i</span><span>n</span><span>g</span><span>\n</span></span><span class=\"undefined\"><span>A</span><span>n</span><span>d</span><span> </span><span>I</span><span> </span><span>a</span><span>m</span><span> </span><span>a</span><span>n</span><span>o</span><span>t</span><span>h</span><span>e</span><span>r</span><span>\n</span></span></span>';
    const output = linkDetector.linkify(input, true);

    assert.strictEqual(2, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('SPAN', output.children[0].tagName);
    assert.strictEqual('SPAN', output.children[1].tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });

  test('multilineWithLinks', () => {
    const input = isWindows ? 'I have a link for you\nHere it is: C:/foo/bar.js:12:34\nCool, huh?' :
      'I have a link for you\nHere it is: /Users/foo/bar.js:12:34\nCool, huh?';
    const expectedOutput = /^<span><span>I have a link for you\n<\/span><span>Here it is: <a tabindex="0">.*\/foo\/bar.js:12:34<\/a>\n<\/span><span>Cool, huh\?<\/span><\/span>$/;
    const output = linkDetector.linkify(input, true);

    assert.strictEqual(3, output.children.length);
    assert.strictEqual('SPAN', output.tagName);
    assert.strictEqual('SPAN', output.children[0].tagName);
    assert.strictEqual('SPAN', output.children[1].tagName);
    assert.strictEqual('SPAN', output.children[2].tagName);
    assert.strictEqual('SPAN', output.children[1].children[0].tagName);
    assert(!expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[1].children[0]);
    assert.strictEqual('H', output.children[1].children[0].textContent);
  });
});
