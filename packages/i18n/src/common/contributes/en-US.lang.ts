export const browserViews = {
  // browserViews
  "kaitianContributes.browserViews": "Provide a custom view to the editor",
  "kaitianContributes.browserViews.left": "Provide a view in the left activity bar container",
  "kaitianContributes.browserViews.right": "Provide a view in the right activity bar container",
  "kaitianContributes.browserViews.bottom": "Provides a view in the bottom tab bar container (no icon will be rendered, so a title is required)",
  "kaitianContributes.browserViews.location.custom": "Provide a view to the \"{0}\" container",
  "kaitianContributes.browserViews.view.id": "View id, browser/index needs to export a component with the same name as this id",
  "kaitianContributes.browserViews.view.icon": "Icon name, reference: [icon](https://docs.antfin-inc.com/iconfont-demo/)",
  "kaitianContributes.browserViews.view.iconPath": "local icon relative path",
  "kaitianContributes.browserViews.view.title": "View title (will be displayed when type is bottom)",
  "kaitianContributes.browserViews.view.titleComponentId": "The id of the custom view title component, the characteristics are exactly the same as the normal browserView",
  "kaitianContributes.browserViews.view.expanded": "Do you need to expand to full screen, which will cover up the editor area",

  // browserMain
  "kaitianContributes.browserMain": "Declare the extension browser entry (the path to the compiled code file relative to the extension directory)",

  // nodeMain
  "kaitianContributes.nodeMain": "Declare the extension node entry (the path to the compiled code file relative to the extension directory)",

  // workerMain
  "kaitianContributes.workerMain": "Declare the extension workser entry (the path to the compiled code file relative to the extension directory)",

  // viewsProxies
  "kaitianContributes.viewsProxies": "Declare the component id that needs to be bound to the componentProxy call, which is the same as the export name. For example, after declaring [\"component\"], the xxxx function of the component component of the browser layer can be called at the node layer through **`context.componentProxy.component.xxxx`**",
}
