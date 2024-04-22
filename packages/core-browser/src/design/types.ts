export const IDesignStyleService = Symbol('IDesignStyleService');

export type TDesignStyles = { [key in string]: string };

export interface IDesignStyleService {
  styles: TDesignStyles;
  setStyles(model: TDesignStyles): void;
  wrapStyles(style: string, key: string): string;
}
