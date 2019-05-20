export type MenuPath = string[];

export const TreeProps = Symbol('TreeProps');

export interface TreeProps {

    /**
     * The path of the context menu that one can use to contribute context menu items to the tree widget.
     */
    readonly contextMenuPath?: MenuPath;

    /**
     * The size of the padding (in pixels) per hierarchy depth. The root element won't have left padding but
     * the padding for the children will be calculated as `leftPadding * hierarchyDepth` and so on.
     */
    readonly leftPadding: number;

    /**
     * `true` if the tree widget support multi-selection. Otherwise, `false`. Defaults to `false`.
     */
    readonly multiSelect?: boolean;

    /**
     * 'true' if the tree widget support searching. Otherwise, `false`. Defaults to `false`.
     */
    readonly search?: boolean;

    /**
     * 'true' if the tree widget should be virtualized searching. Otherwise, `false`. Defaults to `true`.
     */
    readonly virtualized?: boolean;

    /**
     * 'true' if the selected node should be auto scrolled only if the widget is active. Otherwise, `false`.
     *  Defaults to `false`.
     */
    readonly scrollIfActive?: boolean;

    /**
     * `true` if a tree widget contributes to the global selection. Defaults to `false`.
     */
    readonly globalSelection?: boolean;
}
