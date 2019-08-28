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
                kaitianExtendService.bizHello().then(function (msg) {
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
//# sourceMappingURL=component-a.js.map