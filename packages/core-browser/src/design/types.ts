export const IDesignStyleService = Symbol('IDesignStyleService');

export type TDesignStyles = { [key in string]: string };

export interface IDesignStyleService {
  styles: TDesignStyles;
  setStyles(model: TDesignStyles): void;
  getStyles(className: string, defaultStyle?: string): string;
}
