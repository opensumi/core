import { Injectable } from '@opensumi/di';

import { IImageUploadProvider, IImageUploadProviderRegistry } from '../../types';

@Injectable()
export class ImageUploadProviderRegistry implements IImageUploadProviderRegistry {
  private imageUploadProvider: IImageUploadProvider | undefined;

  registerImageUploadProvider(provider: IImageUploadProvider): void {
    this.imageUploadProvider = provider;
  }

  getImageUploadProvider(): IImageUploadProvider | undefined {
    return this.imageUploadProvider;
  }
}

export const ImageUploadProviderRegistryToken = Symbol('ImageUploadProviderRegistry');
