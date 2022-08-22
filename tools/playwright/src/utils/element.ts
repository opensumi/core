import { ElementHandle } from '@playwright/test';

export async function isElementVisible(elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null>) {
  const element = await elementPromise;
  return element ? element.isVisible() : false;
}

export async function containsClass(
  elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null> | undefined,
  cssClass: string,
) {
  return elementContainsClass(await elementPromise, cssClass);
}

export async function elementContainsClass(
  element: ElementHandle<SVGElement | HTMLElement> | null | undefined,
  cssClass: string,
) {
  if (element) {
    const classValue = await element.getAttribute('class');
    if (classValue) {
      return classValue?.split(' ').includes(cssClass);
    }
  }
  return false;
}

export async function textContent(elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null>) {
  const element = await elementPromise;
  if (!element) {
    return undefined;
  }
  const content = await element.textContent();
  return content ? content : undefined;
}
