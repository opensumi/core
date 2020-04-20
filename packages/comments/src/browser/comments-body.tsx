import * as React from 'react';
import * as marked from 'marked';
import * as styles from './comments.module.less';

export const CommentsBody: React.FC<{
  body: string;
}> = React.memo(({ body }) => {
  return (
    <div
      className={styles.comment_item_body}
      dangerouslySetInnerHTML={{
        __html: marked(body, {
          breaks: true,
        }),
      }}></div>
  );
});
