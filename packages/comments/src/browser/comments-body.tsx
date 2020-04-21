import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as marked from 'marked';
import { markdownCss } from './markdown.style';

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

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
    <div ref={shadowRootRef}>
      {shadowRoot && (
        <ShadowContent root={shadowRoot}>
          <style>{markdownCss}</style>
          <div dangerouslySetInnerHTML={{
            __html: marked(body, {
              gfm: true,
              tables: true,
              breaks: false,
              pedantic: false,
              sanitize: true,
              smartLists: true,
              smartypants: false,
            }),
          }}></div>
        </ShadowContent>
      )}
    </div>

  );
});
