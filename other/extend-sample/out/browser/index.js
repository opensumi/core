(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("React"));
	else if(typeof define === 'function' && define.amd)
		define(["React"], factory);
	else if(typeof exports === 'object')
		exports["extend-browser-language-test"] = factory(require("React"));
	else
		root["extend-browser-language-test"] = factory(root["React"]);
})(window, function(__WEBPACK_EXTERNAL_MODULE__0__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 1);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE__0__;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var component_a_1 = __webpack_require__(2);
var component_b_1 = __webpack_require__(3);
exports.default = {
    left: {
        type: 'add',
        component: [
            {
                id: 'comA',
                icon: 'volans_icon debug',
                panel: component_a_1.default,
            },
        ],
    },
    right: {
        type: 'add',
        component: [
            {
                id: 'comB',
                icon: 'volans_icon debug',
                panel: component_b_1.default,
            },
        ],
    },
};


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var React = __webpack_require__(0);
var defaultTitle = '定制组件';
var ComponentA = /** @class */ (function (_super) {
    __extends(ComponentA, _super);
    function ComponentA() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            title: defaultTitle,
        };
        _this.changeTitleHandler = function (val) {
            _this.setState({
                title: defaultTitle + ' ' + val,
            });
        };
        _this.clickHandler = function () {
            // const {bizRPCProtocol, togglePanel} = this.props;
            // bizRPCProtocol.bizHello().then((msg) => {
            //   console.log('biz message result', msg);
            // });
            // if (togglePanel) {
            //   togglePanel();
            // }
            if (_this.props.kaitianExtendService) {
                var kaitianExtendService = _this.props.kaitianExtendService;
                kaitianExtendService.node.bizHello().then(function (msg) {
                    console.log('component a host msg', msg);
                });
            }
        };
        return _this;
    }
    ComponentA.prototype.componentDidMount = function () {
        console.log('this.props', this.props);
        var kaitianExtendSet = this.props.kaitianExtendSet;
        if (kaitianExtendSet) {
            kaitianExtendSet.set({
                changeTitle: this.changeTitleHandler,
            });
        }
    };
    ComponentA.prototype.render = function () {
        return React.createElement("div", { onClick: this.clickHandler, style: { color: 'yellow' } }, this.state.title);
    };
    return ComponentA;
}(React.Component));
exports.default = ComponentA;


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var React = __webpack_require__(0);
var defaultTitle = '右侧定制组件';
var ComponentB = /** @class */ (function (_super) {
    __extends(ComponentB, _super);
    function ComponentB() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            title: defaultTitle,
        };
        _this.changeTitleHandler = function (val) {
            _this.setState({
                title: defaultTitle + ' ' + val,
            });
        };
        _this.clickHandler = function () {
            var kaitianExtendService = _this.props.kaitianExtendService;
            kaitianExtendService.worker.bizWorkerHello().then(function (msg) {
                console.log('component b host msg', msg);
            });
            // if (togglePanel) {
            //   togglePanel();
            // }
        };
        return _this;
    }
    ComponentB.prototype.componentDidMount = function () {
        // const {APIMap} = this.props;
        // if (APIMap) {
        //   APIMap.set({
        //     changeTitle: this.changeTitleHandler,
        //   });
        // }
    };
    ComponentB.prototype.render = function () {
        return React.createElement("div", { onClick: this.clickHandler, style: { color: 'orange' } }, this.state.title);
    };
    return ComponentB;
}(React.Component));
exports.default = ComponentB;


/***/ })
/******/ ]);
});