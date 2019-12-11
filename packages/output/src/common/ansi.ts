import * as React from 'react';
import { AnserJsonEntry } from 'anser';
import { isAbsolute } from '@ali/ide-core-common/lib/path';
import { escapeCarriageReturn } from 'escape-carriage';
const Anser = require('anser');

const LINK_REGEX = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/;

/**
 * Converts ANSI strings into JSON output.
 * @name ansiToJSON
 * @function
 * @param {String} input The input string.
 * @return {Array} The parsed input.
 */
function ansiToJSON(input: string, useClasses = false) {
  input = escapeCarriageReturn(input);
  return Anser.ansiToJson(input, {
    json: true,
    remove_empty: true,
    use_classes: useClasses,
  });
}

/**
 * Create a class string.
 * @name createClass
 * @function
 * @param {AnserJsonEntry}.
 * @return {String} class name(s)
 */
function createClass(bundle: AnserJsonEntry) {
  let classNames: string = '';

  if (!bundle.bg && !bundle.fg) {
    return null;
  }
  if (bundle.bg) {
    classNames += bundle.bg + ' ';
  }
  if (bundle.fg) {
    classNames += bundle.fg + ' ';
  }

  classNames = classNames.substring(0, classNames.length - 1);
  return classNames;
}

/**
 * Create the style attribute.
 * @name createStyle
 * @function
 * @param {AnserJsonEntry}.
 * @return {Object} returns the style object
 */
function createStyle(bundle: AnserJsonEntry) {
  const style: { backgroundColor?: string; color?: string } = {};
  if (bundle.bg) {
    style.backgroundColor = `rgb(${bundle.bg})`;
  }
  if (bundle.fg) {
    style.color = `rgb(${bundle.fg})`;
  }

  return style;
}

/**
 * Converts an Anser bundle into a React Node.
 * @param linkify whether links should be converting into clickable anchor tags.
 * @param useClasses should render the span with a class instead of style.
 * @param bundle Anser output.
 */

function convertBundleIntoReact(
  linkify: boolean,
  useClasses: boolean,
  onPathClick: (path: string) => void,
  bundle: AnserJsonEntry,
  key: number,
) {
  const style = useClasses ? null : createStyle(bundle);
  const className = useClasses ? createClass(bundle) : null;

  if (!linkify) {
    return React.createElement(
      'span',
      { style, key, className },
      bundle.content,
    );
  }

  const words = bundle.content.split(/(\s+)/).reduce(
    (words: React.ReactNode[], word: string, index: number) => {
      // If this is a separator, re-add the space removed from split.
      if (index % 2 === 1) {
        words.push(word);
        return words;
      }

      // If  this isn't a link, just return the word as-is.
      if (LINK_REGEX.test(word)) {
        words.push(
          React.createElement(
            'a',
            {
              key: index,
              href: word,
              target: '_blank',
            },
            `${word}`,
          ),
        );
      } else if (isAbsolute(word)) {
        words.push(
          React.createElement(
            'a',
            {
              key: index,
              target: '_blank',
              onClick: () => {
                onPathClick(word);
              },
            },
            `${word}`,
          ),
        );
      } else {
        words.push(word);
      }

      return words;
    },
    [] as React.ReactNode[],
  );
  return React.createElement('span', { style, key, className }, words);
}

declare interface Props {
  children: string;
  linkify: boolean;
  className?: string;
  useClasses?: boolean;
  onPath?: (path: string) => void;
}

export default function Ansi(props: Props) {
  const { className, useClasses, children, linkify, onPath } = props;
  return React.createElement(
    'code',
    { className },
    ansiToJSON(children, !!useClasses).map(
      convertBundleIntoReact.bind(null, linkify, !!useClasses, onPath),
    ),
  );
}
