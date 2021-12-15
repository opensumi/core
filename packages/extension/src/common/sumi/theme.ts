export interface IMainThreadTheme {
  $getThemeColors(): Promise<{ [key: string]: string }>;
}

export interface IExtHostTheme {
  $notifyThemeChanged(): Promise<void>;
}
