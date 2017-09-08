"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIotDataMock = function (parentObj) {
    return {
        messages: [],
        publish: function (params) {
            var self = parentObj.iotData;
            return {
                promise: function () {
                    self.messages.push(params);
                    return Promise.resolve(params);
                }
            };
        }
    };
};
//# sourceMappingURL=mocks.js.map