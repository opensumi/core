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
var React = require("react");
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
            kaitianExtendService.bizHello().then(function (msg) {
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
//# sourceMappingURL=component-b.js.map