import clx from 'classnames';
import React from 'react';

import { _InternalIcon, IconProps } from './icon';
import { getIconShapeClxList } from './util';

// source code from '@ant-design/icons'
const customCache = new Set<string>();

export interface CustomIconOptions {
  scriptUrl?: string | string[];
  extraCommonProps?: { [key: string]: any };
}

/**
 * 去掉 iconClass 属性
 * 保留的 icon 属性是为了保持 API 一致性，但是不会传递下去
 */
export type IconFontProps<T> = Omit<IconProps<T>, 'iconClass'>;

function isValidCustomScriptUrl(scriptUrl: string): boolean {
  return Boolean(typeof scriptUrl === 'string' && scriptUrl.length && !customCache.has(scriptUrl));
}

function createScriptUrlElements(scriptUrls: string[], index = 0): void {
  const currentScriptUrl = scriptUrls[index];
  if (isValidCustomScriptUrl(currentScriptUrl)) {
    const script = document.createElement('script');
    script.setAttribute('src', currentScriptUrl);
    script.setAttribute('data-namespace', currentScriptUrl);
    if (scriptUrls.length > index + 1) {
      script.onload = () => {
        createScriptUrlElements(scriptUrls, index + 1);
      };
      script.onerror = () => {
        createScriptUrlElements(scriptUrls, index + 1);
      };
    }
    customCache.add(currentScriptUrl);
    document.body.appendChild(script);
  }
}

const svgBaseProps = {
  width: '1em',
  height: '1em',
  fill: 'currentColor',
};

export function createFromIconfontCN<T>(options: CustomIconOptions = {}): React.SFC<IconFontProps<T>> {
  const { scriptUrl, extraCommonProps = {} } = options;

  /**
   * DOM API required.
   * Make sure in browser environment.
   * The Custom Icon will create a <script/>
   * that loads SVG symbols and insert the SVG Element into the document body.
   */
  if (
    scriptUrl &&
    typeof document !== 'undefined' &&
    typeof window !== 'undefined' &&
    typeof document.createElement === 'function'
  ) {
    if (Array.isArray(scriptUrl)) {
      // 因为iconfont资源会把svg插入before，所以前加载相同type会覆盖后加载，为了数组覆盖顺序，倒叙插入
      createScriptUrlElements(scriptUrl.reverse());
    } else {
      createScriptUrlElements([scriptUrl]);
    }
  }

  const IconFont = React.forwardRef<HTMLSpanElement, IconProps>(
    (props: IconProps<T>, ref: React.Ref<HTMLSpanElement>) => {
      const { icon, children, rotate, anim, fill, className = '', ...restProps } = props;
      const iconShapeOptions = { rotate, anim, fill };

      // children > icon
      let content: React.ReactNode = null;
      if (icon) {
        content = (
          <svg {...svgBaseProps} focusable='false'>
            <use xlinkHref={`#${icon}`} />
          </svg>
        );
      }
      if (children) {
        content = children;
      }

      const iconShapeClx = getIconShapeClxList(iconShapeOptions);
      return (
        <_InternalIcon {...extraCommonProps} {...restProps} className={clx(className, iconShapeClx)} ref={ref}>
          {content}
        </_InternalIcon>
      );
    },
  );

  IconFont.displayName = 'Iconfont';

  return IconFont as <T = any>(props: IconProps<T>, ref: React.Ref<HTMLSpanElement>) => React.ReactElement;
}
