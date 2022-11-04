export interface IExtensionWalkthroughStep {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly media:
    | { image: string | { dark: string; light: string; hc: string }; altText: string; markdown?: never; svg?: never }
    | { markdown: string; image?: never; svg?: never }
    | { svg: string; altText: string; markdown?: never; image?: never };
  readonly completionEvents?: string[];
  readonly when?: string;
}

export interface IExtensionWalkthrough {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly description: string;
  readonly steps: IExtensionWalkthroughStep[];
  readonly featuredFor: string[] | undefined;
  readonly when?: string;
}
