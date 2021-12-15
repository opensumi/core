(function webpackUniversalModuleDefinition(root, factory) {
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory(require('kaitian-browser'), require('React'));
  } else if (typeof define === 'function' && define.amd) {
    define(['kaitian-browser', 'React'], factory);
  } else {
    var a =
      typeof exports === 'object'
        ? factory(require('kaitian-browser'), require('React'))
        : factory(root['kaitian-browser'], root['React']);
    for (var i in a) {
      (typeof exports === 'object' ? exports : root)[i] = a[i];
    }
  }
})(window, function (__WEBPACK_EXTERNAL_MODULE_kaitian_browser__, __WEBPACK_EXTERNAL_MODULE_react__) {
  return /** ****/ (function (modules) {
    // webpackBootstrap
    /** ****/ // The module cache
    /** ****/ var installedModules = {};
    /** ****/
    /** ****/ // The require function
    /** ****/ function __webpack_require__(moduleId) {
      /** ****/
      /** ****/ // Check if module is in cache
      /** ****/ if (installedModules[moduleId]) {
        /** ****/ return installedModules[moduleId].exports;
        /** ****/
      }
      /** ****/ // Create a new module (and put it into the cache)
      /** ****/ var module = (installedModules[moduleId] = {
        /** ****/ i: moduleId,
        /** ****/ l: false,
        /** ****/ exports: {},
        /** ****/
      });
      /** ****/
      /** ****/ // Execute the module function
      /** ****/ modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
      /** ****/
      /** ****/ // Flag the module as loaded
      /** ****/ module.l = true;
      /** ****/
      /** ****/ // Return the exports of the module
      /** ****/ return module.exports;
      /** ****/
    }
    /** ****/
    /** ****/
    /** ****/ // expose the modules object (__webpack_modules__)
    /** ****/ __webpack_require__.m = modules;
    /** ****/
    /** ****/ // expose the module cache
    /** ****/ __webpack_require__.c = installedModules;
    /** ****/
    /** ****/ // define getter function for harmony exports
    /** ****/ __webpack_require__.d = function (exports, name, getter) {
      /** ****/ if (!__webpack_require__.o(exports, name)) {
        /** ****/ Object.defineProperty(exports, name, { enumerable: true, get: getter });
        /** ****/
      }
      /** ****/
    };
    /** ****/
    /** ****/ // define __esModule on exports
    /** ****/ __webpack_require__.r = function (exports) {
      /** ****/ if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        /** ****/ Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
        /** ****/
      }
      /** ****/ Object.defineProperty(exports, '__esModule', { value: true });
      /** ****/
    };
    /** ****/
    /** ****/ // create a fake namespace object
    /** ****/ // mode & 1: value is a module id, require it
    /** ****/ // mode & 2: merge all properties of value into the ns
    /** ****/ // mode & 4: return value when already ns object
    /** ****/ // mode & 8|1: behave like require
    /** ****/ __webpack_require__.t = function (value, mode) {
      /** ****/ if (mode & 1) {
        value = __webpack_require__(value);
      }
      /** ****/ if (mode & 8) {
        return value;
      }
      /** ****/ if (mode & 4 && typeof value === 'object' && value && value.__esModule) {
        return value;
      }
      /** ****/ var ns = Object.create(null);
      /** ****/ __webpack_require__.r(ns);
      /** ****/ Object.defineProperty(ns, 'default', { enumerable: true, value });
      /** ****/ if (mode & 2 && typeof value != 'string') {
        for (var key in value) {
          __webpack_require__.d(
            ns,
            key,
            function (key) {
              return value[key];
            }.bind(null, key),
          );
        }
      }
      /** ****/ return ns;
      /** ****/
    };
    /** ****/
    /** ****/ // getDefaultExport function for compatibility with non-harmony modules
    /** ****/ __webpack_require__.n = function (module) {
      /** ****/ var getter =
        module && module.__esModule
          ? /** ****/ function getDefault() {
              return module['default'];
            }
          : /** ****/ function getModuleExports() {
              return module;
            };
      /** ****/ __webpack_require__.d(getter, 'a', getter);
      /** ****/ return getter;
      /** ****/
    };
    /** ****/
    /** ****/ // Object.prototype.hasOwnProperty.call
    /** ****/ __webpack_require__.o = function (object, property) {
      return Object.prototype.hasOwnProperty.call(object, property);
    };
    /** ****/
    /** ****/ // __webpack_public_path__
    /** ****/ __webpack_require__.p = '';
    /** ****/
    /** ****/
    /** ****/ // Load entry module and return exports
    /** ****/ return __webpack_require__((__webpack_require__.s = './src/extend/browser/index.ts'));
    /** ****/
  })(
    /** **********************************************************************/
    /** ****/ {
      /***/ './node_modules/_css-loader@3.6.0@css-loader/dist/cjs.js!./node_modules/_less-loader@5.0.0@less-loader/dist/cjs.js?!./src/extend/browser/style.less':
        /* !*******************************************************************************************************************************************************************!*\
  !*** ./node_modules/_css-loader@3.6.0@css-loader/dist/cjs.js!./node_modules/_less-loader@5.0.0@less-loader/dist/cjs.js??ref--7-2!./src/extend/browser/style.less ***!
  \*******************************************************************************************************************************************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          // Imports
          var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(
            /* ! ../../../node_modules/_css-loader@3.6.0@css-loader/dist/runtime/api.js */ './node_modules/_css-loader@3.6.0@css-loader/dist/runtime/api.js',
          );
          exports = ___CSS_LOADER_API_IMPORT___(false);
          // Module
          exports.push([
            module.i,
            '.kt-extension-example-container {\n  flex: 1;\n  width: 100%;\n  height: 100%;\n  flex-direction: column;\n  background-color: var(--statusBar-background);\n}\n',
            '',
          ]);
          // Exports
          module.exports = exports;

          /***/
        },

      /***/ './node_modules/_css-loader@3.6.0@css-loader/dist/runtime/api.js':
        /* !***********************************************************************!*\
  !*** ./node_modules/_css-loader@3.6.0@css-loader/dist/runtime/api.js ***!
  \***********************************************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          'use strict';

          /*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
          // css base code, injected by the css-loader
          // eslint-disable-next-line func-names
          module.exports = function (useSourceMap) {
            var list = []; // return the list of modules as css string

            list.toString = function toString() {
              return this.map(function (item) {
                var content = cssWithMappingToString(item, useSourceMap);

                if (item[2]) {
                  return '@media '.concat(item[2], ' {').concat(content, '}');
                }

                return content;
              }).join('');
            }; // import a list of modules into the list
            // eslint-disable-next-line func-names

            list.i = function (modules, mediaQuery, dedupe) {
              if (typeof modules === 'string') {
                // eslint-disable-next-line no-param-reassign
                modules = [[null, modules, '']];
              }

              var alreadyImportedModules = {};

              if (dedupe) {
                for (var i = 0; i < this.length; i++) {
                  // eslint-disable-next-line prefer-destructuring
                  var id = this[i][0];

                  if (id != null) {
                    alreadyImportedModules[id] = true;
                  }
                }
              }

              for (var _i = 0; _i < modules.length; _i++) {
                var item = [].concat(modules[_i]);

                if (dedupe && alreadyImportedModules[item[0]]) {
                  // eslint-disable-next-line no-continue
                  continue;
                }

                if (mediaQuery) {
                  if (!item[2]) {
                    item[2] = mediaQuery;
                  } else {
                    item[2] = ''.concat(mediaQuery, ' and ').concat(item[2]);
                  }
                }

                list.push(item);
              }
            };

            return list;
          };

          function cssWithMappingToString(item, useSourceMap) {
            var content = item[1] || ''; // eslint-disable-next-line prefer-destructuring

            var cssMapping = item[3];

            if (!cssMapping) {
              return content;
            }

            if (useSourceMap && typeof btoa === 'function') {
              var sourceMapping = toComment(cssMapping);
              var sourceURLs = cssMapping.sources.map(function (source) {
                return '/*# sourceURL='.concat(cssMapping.sourceRoot || '').concat(source, ' */');
              });
              return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
            }

            return [content].join('\n');
          } // Adapted from convert-source-map (MIT)

          function toComment(sourceMap) {
            // eslint-disable-next-line no-undef
            var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
            var data = 'sourceMappingURL=data:application/json;charset=utf-8;base64,'.concat(base64);
            return '/*# '.concat(data, ' */');
          }

          /***/
        },

      /***/ './node_modules/_style-loader@1.3.0@style-loader/dist/runtime/injectStylesIntoStyleTag.js':
        /* !************************************************************************************************!*\
  !*** ./node_modules/_style-loader@1.3.0@style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \************************************************************************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          'use strict';

          var isOldIE = (function isOldIE() {
            var memo;
            return function memorize() {
              if (typeof memo === 'undefined') {
                // Test for IE <= 9 as proposed by Browserhacks
                // @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
                // Tests for existence of standard globals is to allow style-loader
                // to operate correctly into non-standard environments
                // @see https://github.com/webpack-contrib/style-loader/issues/177
                memo = Boolean(window && document && document.all && !window.atob);
              }

              return memo;
            };
          })();

          var getTarget = (function getTarget() {
            var memo = {};
            return function memorize(target) {
              if (typeof memo[target] === 'undefined') {
                var styleTarget = document.querySelector(target); // Special case to return head of iframe instead of iframe itself

                if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
                  try {
                    // This will throw an exception if access to iframe is blocked
                    // due to cross-origin restrictions
                    styleTarget = styleTarget.contentDocument.head;
                  } catch (e) {
                    // istanbul ignore next
                    styleTarget = null;
                  }
                }

                memo[target] = styleTarget;
              }

              return memo[target];
            };
          })();

          var stylesInDom = [];

          function getIndexByIdentifier(identifier) {
            var result = -1;

            for (var i = 0; i < stylesInDom.length; i++) {
              if (stylesInDom[i].identifier === identifier) {
                result = i;
                break;
              }
            }

            return result;
          }

          function modulesToDom(list, options) {
            var idCountMap = {};
            var identifiers = [];

            for (var i = 0; i < list.length; i++) {
              var item = list[i];
              var id = options.base ? item[0] + options.base : item[0];
              var count = idCountMap[id] || 0;
              var identifier = ''.concat(id, ' ').concat(count);
              idCountMap[id] = count + 1;
              var index = getIndexByIdentifier(identifier);
              var obj = {
                css: item[1],
                media: item[2],
                sourceMap: item[3],
              };

              if (index !== -1) {
                stylesInDom[index].references++;
                stylesInDom[index].updater(obj);
              } else {
                stylesInDom.push({
                  identifier,
                  updater: addStyle(obj, options),
                  references: 1,
                });
              }

              identifiers.push(identifier);
            }

            return identifiers;
          }

          function insertStyleElement(options) {
            var style = document.createElement('style');
            var attributes = options.attributes || {};

            if (typeof attributes.nonce === 'undefined') {
              var nonce = true ? __webpack_require__.nc : undefined;

              if (nonce) {
                attributes.nonce = nonce;
              }
            }

            Object.keys(attributes).forEach(function (key) {
              style.setAttribute(key, attributes[key]);
            });

            if (typeof options.insert === 'function') {
              options.insert(style);
            } else {
              var target = getTarget(options.insert || 'head');

              if (!target) {
                throw new Error(
                  "Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.",
                );
              }

              target.appendChild(style);
            }

            return style;
          }

          function removeStyleElement(style) {
            // istanbul ignore if
            if (style.parentNode === null) {
              return false;
            }

            style.parentNode.removeChild(style);
          }
          /* istanbul ignore next  */

          var replaceText = (function replaceText() {
            var textStore = [];
            return function replace(index, replacement) {
              textStore[index] = replacement;
              return textStore.filter(Boolean).join('\n');
            };
          })();

          function applyToSingletonTag(style, index, remove, obj) {
            var css = remove ? '' : obj.media ? '@media '.concat(obj.media, ' {').concat(obj.css, '}') : obj.css; // For old IE

            /* istanbul ignore if  */

            if (style.styleSheet) {
              style.styleSheet.cssText = replaceText(index, css);
            } else {
              var cssNode = document.createTextNode(css);
              var childNodes = style.childNodes;

              if (childNodes[index]) {
                style.removeChild(childNodes[index]);
              }

              if (childNodes.length) {
                style.insertBefore(cssNode, childNodes[index]);
              } else {
                style.appendChild(cssNode);
              }
            }
          }

          function applyToTag(style, options, obj) {
            var css = obj.css;
            var media = obj.media;
            var sourceMap = obj.sourceMap;

            if (media) {
              style.setAttribute('media', media);
            } else {
              style.removeAttribute('media');
            }

            if (sourceMap && typeof btoa !== 'undefined') {
              css += '\n/*# sourceMappingURL=data:application/json;base64,'.concat(
                btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))),
                ' */',
              );
            } // For old IE

            /* istanbul ignore if  */

            if (style.styleSheet) {
              style.styleSheet.cssText = css;
            } else {
              while (style.firstChild) {
                style.removeChild(style.firstChild);
              }

              style.appendChild(document.createTextNode(css));
            }
          }

          var singleton = null;
          var singletonCounter = 0;

          function addStyle(obj, options) {
            var style;
            var update;
            var remove;

            if (options.singleton) {
              var styleIndex = singletonCounter++;
              style = singleton || (singleton = insertStyleElement(options));
              update = applyToSingletonTag.bind(null, style, styleIndex, false);
              remove = applyToSingletonTag.bind(null, style, styleIndex, true);
            } else {
              style = insertStyleElement(options);
              update = applyToTag.bind(null, style, options);

              remove = function remove() {
                removeStyleElement(style);
              };
            }

            update(obj);
            return function updateStyle(newObj) {
              if (newObj) {
                if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap) {
                  return;
                }

                update((obj = newObj));
              } else {
                remove();
              }
            };
          }

          module.exports = function (list, options) {
            options = options || {}; // Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
            // tags it will allow on a page

            if (!options.singleton && typeof options.singleton !== 'boolean') {
              options.singleton = isOldIE();
            }

            list = list || [];
            var lastIdentifiers = modulesToDom(list, options);
            return function update(newList) {
              newList = newList || [];

              if (Object.prototype.toString.call(newList) !== '[object Array]') {
                return;
              }

              for (var i = 0; i < lastIdentifiers.length; i++) {
                var identifier = lastIdentifiers[i];
                var index = getIndexByIdentifier(identifier);
                stylesInDom[index].references--;
              }

              var newLastIdentifiers = modulesToDom(newList, options);

              for (var _i = 0; _i < lastIdentifiers.length; _i++) {
                var _identifier = lastIdentifiers[_i];

                var _index = getIndexByIdentifier(_identifier);

                if (stylesInDom[_index].references === 0) {
                  stylesInDom[_index].updater();

                  stylesInDom.splice(_index, 1);
                }
              }

              lastIdentifiers = newLastIdentifiers;
            };
          };

          /***/
        },

      /***/ './src/extend/browser/Leftview.tsx':
        /* !*****************************************!*\
  !*** ./src/extend/browser/Leftview.tsx ***!
  \*****************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          'use strict';

          Object.defineProperty(exports, '__esModule', { value: true });
          exports.TitleView = exports.Leftview = void 0;
          const React = __webpack_require__(/* ! react */ 'react');
          const react_1 = __webpack_require__(/* ! react */ 'react');
          const kaitian_browser_1 = __webpack_require__(/* ! kaitian-browser */ 'kaitian-browser');
          __webpack_require__(/* ! ./style.less */ './src/extend/browser/style.less');
          const defaultTitle = '左侧面板';
          exports.Leftview = ({ kaitianExtendSet, kaitianExtendService }) => {
            const [title, setTitle] = react_1.useState(defaultTitle);
            function onDidUpdateTitle(val) {
              setTitle(defaultTitle + ' ' + val);
            }
            react_1.useEffect(() => {
              if (kaitianExtendSet) {
                kaitianExtendSet.set({
                  updateTitle: onDidUpdateTitle,
                });
              }
            }, []);
            function clickHandler() {
              kaitianExtendService.node.sayHello().then((msg) => {
                console.log('Leftview receive message', msg);
              });
            }
            return React.createElement(
              'div',
              { className: 'kt-extension-example-container' },
              React.createElement('p', null, title),
              React.createElement(kaitian_browser_1.Button, { onClick: clickHandler }, 'change title'),
            );
          };
          exports.TitleView = ({ kaitianExtendSet, kaitianExtendService }) =>
            React.createElement(
              'div',
              {
                onClick: () =>
                  kaitianExtendService.node.sayHello().then((msg) => {
                    console.log('title view receive message111', msg);
                  }),
              },
              'Hello custom header',
            );

          /***/
        },

      /***/ './src/extend/browser/index.ts':
        /* !*************************************!*\
  !*** ./src/extend/browser/index.ts ***!
  \*************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          'use strict';

          Object.defineProperty(exports, '__esModule', { value: true });
          exports.TitleView = exports.Leftview = void 0;
          const Leftview_1 = __webpack_require__(/* ! ./Leftview */ './src/extend/browser/Leftview.tsx');
          Object.defineProperty(exports, 'Leftview', {
            enumerable: true,
            get() {
              return Leftview_1.Leftview;
            },
          });
          Object.defineProperty(exports, 'TitleView', {
            enumerable: true,
            get() {
              return Leftview_1.TitleView;
            },
          });

          /***/
        },

      /***/ './src/extend/browser/style.less':
        /* !***************************************!*\
  !*** ./src/extend/browser/style.less ***!
  \***************************************/
        /* ! no static exports found */
        /***/ function (module, exports, __webpack_require__) {
          var api = __webpack_require__(
            /* ! ../../../node_modules/_style-loader@1.3.0@style-loader/dist/runtime/injectStylesIntoStyleTag.js */ './node_modules/_style-loader@1.3.0@style-loader/dist/runtime/injectStylesIntoStyleTag.js',
          );
          var content = __webpack_require__(
            /* ! !../../../node_modules/_css-loader@3.6.0@css-loader/dist/cjs.js!../../../node_modules/_less-loader@5.0.0@less-loader/dist/cjs.js??ref--7-2!./style.less */ './node_modules/_css-loader@3.6.0@css-loader/dist/cjs.js!./node_modules/_less-loader@5.0.0@less-loader/dist/cjs.js?!./src/extend/browser/style.less',
          );

          content = content.__esModule ? content.default : content;

          if (typeof content === 'string') {
            content = [[module.i, content, '']];
          }

          var options = {};

          options.insert = 'head';
          options.singleton = false;

          var update = api(content, options);

          module.exports = content.locals || {};

          /***/
        },

      /***/ 'kaitian-browser':
        /* !**********************************!*\
  !*** external "kaitian-browser" ***!
  \**********************************/
        /* ! no static exports found */
        /***/ function (module, exports) {
          module.exports = __WEBPACK_EXTERNAL_MODULE_kaitian_browser__;

          /***/
        },

      /***/ react:
        /* !************************!*\
  !*** external "React" ***!
  \************************/
        /* ! no static exports found */
        /***/ function (module, exports) {
          module.exports = __WEBPACK_EXTERNAL_MODULE_react__;

          /***/
        },

      /** ****/
    },
  );
});
