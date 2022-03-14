import { marked } from 'marked';
import React from 'react';
import ReactDOM from 'react-dom';

import styles from './comments.module.less';
import { markdownCss } from './markdown.style';

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

const renderer = new marked.Renderer();

renderer.link = (href, title, text) => `<a target="_blank" rel="noopener" href="${href}" title="${title}">${text}</a>`;

export const CommentsBody: React.FC<{
  body: string;
}> = React.memo(({ body }) => {
  const shadowRootRef = React.useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);

  React.useEffect(() => {
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }
    }
  }, []);

  return (
    <div ref={shadowRootRef} className={styles.comment_shadow_box}>
      {shadowRoot && (
        <ShadowContent root={shadowRoot}>
          <style>{markdownCss}</style>
          <div
            dangerouslySetInnerHTML={{
              __html: marked(body, {
                gfm: true,
                breaks: false,
                pedantic: false,
                sanitize: true,
                smartLists: true,
                smartypants: false,
                renderer,
              }),
            }}
          ></div>
        </ShadowContent>
      )}
    </div>
  );
});
