import React from 'react';

import { IChatToolContent, uuid } from '@opensumi/ide-core-common';

import { CodeEditorWithHighlight } from './ChatEditor';

export const ChatToolRender = (props: { value: IChatToolContent['content'] }) => {
    const { value } = props;
    console.log('🚀 ~ ChatToolRender ~ toolCall:', value);

    if (!value || !value.function || !value.id) {
        return null;
    }

    return <div>
        <span>Using Tool: </span>
        <span>{value?.function?.name}</span>
        <br />
        <span></span>
        {
            value?.function?.arguments &&
            (<CodeEditorWithHighlight
                input={value?.function?.arguments}
                language={'json'}
                relationId={uuid(4)}
            />)
        }
    </div>;
};
