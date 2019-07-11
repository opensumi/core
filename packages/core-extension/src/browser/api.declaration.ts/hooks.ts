import { BrowserModule } from '@ali/ide-core-browser';

export interface ICoreExtensionBrowserContribution  {

  provideBrowserModules(): BrowserModule[];

}

export interface IBrowserLifeCycleContribution {

  onWillStartApp?();

  onDidStartApp?();

  willEnableFeatureExtensions?();

  DidEnableFeatureExtensions?();

  willRenderApp?();

  DidRenderApp?();

}
