import { WidgetProps } from '@rjsf/utils';
import React, { useMemo } from 'react';

import { Input } from '@opensumi/ide-components';
import { SnippetParser } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/snippet/browser/snippetParser';

import styles from './json-widget.module.less';

const isHasSnippetRegex = new RegExp(/\${(.*)/);
/**
 * 在 Windows 中, 直接使用 \" 来转义双引号可能会被解析为文件路径中的反斜杠，从而导致路径错误。
 * 为了避免这个问题，一些插件内使用 ^\" 来表示转义的双引号，这样就不会被解析为文件路径中的反斜杠了。
 * 当调试器解析 launch.json 文件并读取字符串值时，它会将 ^" 转换为双引号。
 * 而我们在这里为了需要把转义后的字符串能正确展示，就需要用正则去剔除
 */
const doubleQuotesRegex = new RegExp(/^\^\"(.*)\"/gm);

/**
 * 使用 monaco 内部的 SnippetParser 来转换形如 ${1:xxxx} 这样的符号
 */
const snippet = new SnippetParser();

export const TextWidget = (props: WidgetProps) => {
  const { disabled, formContext, id, onBlur, onChange, onFocus, options, placeholder, readonly, schema, value } = props;
  const { readonlyAsDisabled = true } = formContext;

  const parseValue = useMemo(() => {
    if (typeof value !== 'string') {
      return value;
    }

    if (isHasSnippetRegex.test(value)) {
      const snippetParse = snippet.text(value);
      return snippetParse.replace(doubleQuotesRegex, '$1');
    }

    return value;
  }, [value]);

  const handleTextChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(target.value === '' ? options.emptyValue : target.value);

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, target.value);

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, target.value);

  const type = useMemo(() => {
    if (schema.type !== 'string' && schema.type !== 'number') {
      return 'string';
    }

    return schema.type;
  }, [schema, schema.type]);

  return (
    <Input
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleTextChange : undefined}
      onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      type={type}
      value={parseValue}
      className={styles.text_widget_control}
      autoComplete='off'
    />
  );
};
