(function webpackUniversalModuleDefinition(root, factory) {
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory(require('React'));
  } else if (typeof define === 'function' && define.amd) {
    define(['React'], factory);
  } else if (typeof exports === 'object') {
    exports['extend-browser-aligenie-plugin'] = factory(require('React'));
  } else {
    root['extend-browser-aligenie-plugin'] = factory(root['React']);
  }
})({}, function(__WEBPACK_EXTERNAL_MODULE__0__) {
  return /** ****/ (function(modules) {
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
    /** ****/ __webpack_require__.d = function(exports, name, getter) {
      /** ****/ if (!__webpack_require__.o(exports, name)) {
        /** ****/ Object.defineProperty(exports, name, { enumerable: true, get: getter });
        /** ****/
      }
      /** ****/
    };
    /** ****/
    /** ****/ // define __esModule on exports
    /** ****/ __webpack_require__.r = function(exports) {
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
    /** ****/ __webpack_require__.t = function(value, mode) {
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
            function(key) {
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
    /** ****/ __webpack_require__.n = function(module) {
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
    /** ****/ __webpack_require__.o = function(object, property) {
      return Object.prototype.hasOwnProperty.call(object, property);
    };
    /** ****/
    /** ****/ // __webpack_public_path__
    /** ****/ __webpack_require__.p = '';
    /** ****/
    /** ****/
    /** ****/ // Load entry module and return exports
    /** ****/ return __webpack_require__((__webpack_require__.s = 1));
    /** ****/
  })(
    /** **********************************************************************/
    /** ****/ [
      /* 0 */
      /***/ function(module, exports) {
        module.exports = __WEBPACK_EXTERNAL_MODULE__0__;

        /***/
      },
      /* 1 */
      /***/ function(module, exports, __webpack_require__) {
        module.exports = __webpack_require__(2);

        /***/
      },
      /* 2 */
      /***/ function(module, __webpack_exports__, __webpack_require__) {
        'use strict';
        // ESM COMPAT FLAG
        __webpack_require__.r(__webpack_exports__);

        // EXTERNAL MODULE: external "React"
        var external_React_ = __webpack_require__(0);

        // CONCATENATED MODULE: ./src/extend/browser/mockplugin.tsx

        const PluginsPanel = () => {
          function handleClick() {
            //
          }
          return external_React_['createElement']('div', { onClick: handleClick }, 'mock panel');
        };

        const PluginsEditor = () => external_React_['createElement']('div', {}, 'mock editor');

        const PluginsToolBar = () => external_React_['createElement']('div', {}, 'mock editor');
        // CONCATENATED MODULE: ./src/extend/browser/index.ts

        /* harmony default export */ var browser = (__webpack_exports__['default'] = {
          left: {
            type: 'add',
            component: [
              {
                id: 'PluginsPanel',
                iconPath: './icons/entry.svg',
                priority: 10,
                panel: PluginsPanel,
              },
            ],
          },
          editor: {
            type: 'add',
            component: [
              {
                id: 'PluginsEditor',
                panel: PluginsEditor,
              },
            ],
          },
          toolBar: {
            type: 'add',
            component: [
              {
                id: 'PluginsToolBar',
                panel: PluginsToolBar,
              },
            ],
          },
        });

        /***/
      },
      /** ****/
    ],
  );
});
