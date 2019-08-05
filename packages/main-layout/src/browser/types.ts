export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  onDidUseConfig(): void;

}
