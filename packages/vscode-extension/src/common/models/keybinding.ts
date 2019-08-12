export interface IKeybindings {
  primary?: number;
  secondary?: number[];
  win?: {
    primary: number;
    secondary?: number[];
  };
  linux?: {
    primary: number;
    secondary?: number[];
  };
  mac?: {
    primary: number;
    secondary?: number[];
  };
}
