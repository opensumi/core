export namespace EditorKeybindingContexts {

    /**
     * 活动文本编辑器具有焦点时启用的键绑定上下文的ID。
     */
    export const editorTextFocus = 'editorTextFocus';

    /**
     * 当活动差异编辑器具有焦点时启用的键绑定上下文的ID。
     */
    export const diffEditorTextFocus = 'diffEditorTextFocus';

    /**
     * 如果活动编辑器具有焦点但没有任何重叠小部件（例如内容辅助小部件），则启用的键绑定上下文的唯一标识符。
     */
    export const strictEditorTextFocus = 'strictEditorTextFocus';
}
