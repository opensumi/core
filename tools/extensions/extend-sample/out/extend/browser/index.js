"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var component_a_1 = require("./component-a");
var component_b_1 = require("./component-b");
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
//# sourceMappingURL=index.js.map