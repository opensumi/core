export interface LanguageContribution {
  id: string;
  name: string;
}

export interface ILanguageClientContribution extends LanguageContribution {
  waitForActivate(): void;
}

export interface ILanguageServerContribution extends LanguageContribution {
  start(): void;
}

export const LanguageContribution = Symbol('LanguageContribution');

export const TYPESCRIPT_LANGUAGE_ID = 'typescript';
export const TYPESCRIPT_LANGUAGE_NAME = 'TypeScript';
