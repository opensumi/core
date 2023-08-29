declare module 'vscode' {
  /**
   * A reference to one of the workbench colors as defined in https://code.visualstudio.com/docs/getstarted/theme-color-reference.
   * Using a theme color is preferred over a custom color as it gives theme authors and users the possibility to change the color.
   */
  export class ThemeColor {
    /**
     * Creates a reference to a theme color.
     * @param id of the color. The available colors are listed in https://code.visualstudio.com/docs/getstarted/theme-color-reference.
     */
    constructor(id: string);
  }

  /**
   * A reference to a named icon. Currently, [File](#ThemeIcon.File), [Folder](#ThemeIcon.Folder),
   * and [ThemeIcon ids](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing) are supported.
   * Using a theme icon is preferred over a custom icon as it gives product theme authors the possibility to change the icons.
   *
   * *Note* that theme icons can also be rendered inside labels and descriptions. Places that support theme icons spell this out
   * and they use the `$(<name>)`-syntax, for instance `quickPick.label = "Hello World $(globe)"`.
   */
  export class ThemeIcon {
    /**
     * Reference to an icon representing a file. The icon is taken from the current file icon theme or a placeholder icon is used.
     */
    static readonly File: ThemeIcon;

    /**
     * Reference to an icon representing a folder. The icon is taken from the current file icon theme or a placeholder icon is used.
     */
    static readonly Folder: ThemeIcon;

    /**
     * The id of the icon. The available icons are listed in https://code.visualstudio.com/api/references/icons-in-labels#icon-listing.
     */
    readonly id: string;

    /**
     * The optional ThemeColor of the icon. The color is currently only used in [TreeItem](#TreeItem).
     */
    readonly color?: ThemeColor;

    /**
     * Creates a reference to a theme icon.
     * @param id id of the icon. The avaiable icons are listed in https://microsoft.github.io/vscode-codicons/dist/codicon.html.
     */
    constructor(id: string);

    /**
     * Creates a reference to a theme icon.
     * @param id id of the icon. The available icons are listed in https://code.visualstudio.com/api/references/icons-in-labels#icon-listing.
     * @param color optional `ThemeColor` for the icon. The color is currently only used in [TreeItem](#TreeItem).
     */
    constructor(id: string, color?: ThemeColor);
  }

  /**
   * Represents theme specific rendering styles for a [text editor decoration](#TextEditorDecorationType).
   */
  export interface ThemableDecorationRenderOptions {
    /**
     * Background color of the decoration. Use rgba() and define transparent background colors to play well with other decorations.
     * Alternatively a color from the color registry can be [referenced](#ThemeColor).
     */
    backgroundColor?: string | ThemeColor;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    outline?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'outline' for setting one or more of the individual outline properties.
     */
    outlineColor?: string | ThemeColor;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'outline' for setting one or more of the individual outline properties.
     */
    outlineStyle?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'outline' for setting one or more of the individual outline properties.
     */
    outlineWidth?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    border?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'border' for setting one or more of the individual border properties.
     */
    borderColor?: string | ThemeColor;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'border' for setting one or more of the individual border properties.
     */
    borderRadius?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'border' for setting one or more of the individual border properties.
     */
    borderSpacing?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'border' for setting one or more of the individual border properties.
     */
    borderStyle?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     * Better use 'border' for setting one or more of the individual border properties.
     */
    borderWidth?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    fontStyle?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    fontWeight?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    textDecoration?: string;
    /**
     * @proposal
     */
    textUnderlinePosition?: string;
    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    cursor?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    color?: string | ThemeColor;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    opacity?: string;

    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    letterSpacing?: string;

    /**
     * An **absolute path** or an URI to an image to be rendered in the gutter.
     */
    gutterIconPath?: string | Uri;

    /**
     * Specifies the size of the gutter icon.
     * Available values are 'auto', 'contain', 'cover' and any percentage value.
     * For further information: https://msdn.microsoft.com/en-us/library/jj127316(v=vs.85).aspx
     */
    gutterIconSize?: string;

    /**
     * The color of the decoration in the overview ruler. Use rgba() and define transparent colors to play well with other decorations.
     */
    overviewRulerColor?: string | ThemeColor;

    /**
     * Defines the rendering options of the attachment that is inserted before the decorated text.
     */
    before?: ThemableDecorationAttachmentRenderOptions;

    /**
     * Defines the rendering options of the attachment that is inserted after the decorated text.
     */
    after?: ThemableDecorationAttachmentRenderOptions;
  }

  export interface ThemableDecorationAttachmentRenderOptions {
    /**
     * Defines a text content that is shown in the attachment. Either an icon or a text can be shown, but not both.
     */
    contentText?: string;
    /**
     * An **absolute path** or an URI to an image to be rendered in the attachment. Either an icon
     * or a text can be shown, but not both.
     */
    contentIconPath?: string | Uri;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    border?: string;
    /**
     * CSS styling property that will be applied to text enclosed by a decoration.
     */
    borderColor?: string | ThemeColor;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    fontStyle?: string;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    fontWeight?: string;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    textDecoration?: string;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    color?: string | ThemeColor;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    backgroundColor?: string | ThemeColor;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    margin?: string;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    width?: string;
    /**
     * CSS styling property that will be applied to the decoration attachment.
     */
    height?: string;
  }


  /**
   * Represents a color in RGBA space.
   */
  export class Color {

    /**
     * The red component of this color in the range [0-1].
     */
    readonly red: number;

    /**
     * The green component of this color in the range [0-1].
     */
    readonly green: number;

    /**
     * The blue component of this color in the range [0-1].
     */
    readonly blue: number;

    /**
     * The alpha component of this color in the range [0-1].
     */
    readonly alpha: number;

    /**
     * Creates a new color instance.
     *
     * @param red The red component.
     * @param green The green component.
     * @param blue The blue component.
     * @param alpha The alpha component.
     */
    constructor(red: number, green: number, blue: number, alpha: number);
  }

  /**
   * Represents a color range from a document.
   */
  export class ColorInformation {

    /**
     * The range in the document where this color appears.
     */
    range: Range;

    /**
     * The actual color value for this color range.
     */
    color: Color;

    /**
     * Creates a new color range.
     *
     * @param range The range the color appears in. Must not be empty.
     * @param color The value of the color.
     * @param format The format in which this color is currently formatted.
     */
    constructor(range: Range, color: Color);
  }

  /**
   * A color presentation object describes how a [`color`](#Color) should be represented as text and what
   * edits are required to refer to it from source code.
   *
   * For some languages one color can have multiple presentations, e.g. css can represent the color red with
   * the constant `Red`, the hex-value `#ff0000`, or in rgba and hsla forms. In csharp other representations
   * apply, e.g. `System.Drawing.Color.Red`.
   */
  export class ColorPresentation {

    /**
     * The label of this color presentation. It will be shown on the color
     * picker header. By default this is also the text that is inserted when selecting
     * this color presentation.
     */
    label: string;

    /**
     * An [edit](#TextEdit) which is applied to a document when selecting
     * this presentation for the color.  When `falsy` the [label](#ColorPresentation.label)
     * is used.
     */
    textEdit?: TextEdit;

    /**
     * An optional array of additional [text edits](#TextEdit) that are applied when
     * selecting this color presentation. Edits must not overlap with the main [edit](#ColorPresentation.textEdit) nor with themselves.
     */
    additionalTextEdits?: TextEdit[];

    /**
     * Creates a new color presentation.
     *
     * @param label The label of this color presentation.
     */
    constructor(label: string);
  }

  /**
   * The document color provider defines the contract between extensions and feature of
   * picking and modifying colors in the editor.
   */
  export interface DocumentColorProvider {

    /**
     * Provide colors for the given document.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @return An array of [color information](#ColorInformation) or a thenable that resolves to such. The lack of a result
     * can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentColors(document: TextDocument, token: CancellationToken): ProviderResult<ColorInformation[]>;

    /**
     * Provide [representations](#ColorPresentation) for a color.
     *
     * @param color The color to show and insert.
     * @param context A context object with additional information
     * @param token A cancellation token.
     * @return An array of color presentations or a thenable that resolves to such. The lack of a result
     * can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideColorPresentations(color: Color, context: { document: TextDocument, range: Range }, token: CancellationToken): ProviderResult<ColorPresentation[]>;
  }
}
