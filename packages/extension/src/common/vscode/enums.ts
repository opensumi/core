/**
 * Denotes a location of an editor in the window. Editors can be arranged in a grid
 * and each column represents one editor location in that grid by counting the editors
 * in order of their appearance.
 */
export enum ViewColumn {
  /**
   * A *symbolic* editor column representing the currently active column. This value
   * can be used when opening editors, but the *resolved* [viewColumn](#TextEditor.viewColumn)-value
   * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Active`.
   */
  Active = -1,
  /**
   * A *symbolic* editor column representing the column to the side of the active one. This value
   * can be used when opening editors, but the *resolved* [viewColumn](#TextEditor.viewColumn)-value
   * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Beside`.
   */
  Beside = -2,
  /**
   * The first editor column.
   */
  One = 1,
  /**
   * The second editor column.
   */
  Two = 2,
  /**
   * The third editor column.
   */
  Three = 3,
  /**
   * The fourth editor column.
   */
  Four = 4,
  /**
   * The fifth editor column.
   */
  Five = 5,
  /**
   * The sixth editor column.
   */
  Six = 6,
  /**
   * The seventh editor column.
   */
  Seven = 7,
  /**
   * The eighth editor column.
   */
  Eight = 8,
  /**
   * The ninth editor column.
   */
  Nine = 9,
}
