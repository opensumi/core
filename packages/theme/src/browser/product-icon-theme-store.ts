import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';

import { IProductIconTheme, IThemeContribution, getThemeId } from '../common';

import { ProductIconThemeData } from './product-icon-theme-data';

@Injectable()
export class ProductIconThemeStore {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private productIconThemeMap: Map<string, IProductIconTheme> = new Map();

  async getProductIconTheme(contribution?: IThemeContribution, basePath?: URI): Promise<IProductIconTheme | undefined> {
    if (!contribution || !basePath) {
      return;
    }
    const id = getThemeId(contribution);

    const cachedTheme = this.productIconThemeMap.get(id);
    if (cachedTheme) {
      return cachedTheme;
    }
    const iconTheme = await this.initProductIconTheme(contribution, basePath);
    this.productIconThemeMap.set(id, iconTheme);
    return iconTheme;
  }

  protected async initProductIconTheme(contribution: IThemeContribution, basePath: URI): Promise<ProductIconThemeData> {
    const contributedPath = contribution.path.replace(/^\.\//, '');
    const themeLocation = basePath.resolve(contributedPath);
    const iconThemeData = this.injector.get(ProductIconThemeData, [
      contribution.id,
      contribution.label,
      contribution.extensionId,
    ]);
    await iconThemeData.load(themeLocation);
    return iconThemeData;
  }
}
