"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var PubSub = /** @class */ (function () {
    function PubSub(functionName) {
        this.lambda = new AWS.Lambda();
        this.functionName = functionName;
    }
    PubSub.prototype.publish = function (triggerName, payload) {
        var params = {
            FunctionName: this.functionName,
            InvocationType: 'Event',
            Payload: JSON.stringify({ triggerName: triggerName, payload: payload })
        };
        return this.lambda.invoke(params).promise();
    };
    ;
    return PubSub;
}());
exports.PubSub = PubSub;
//# sourceMappingURL=pubsub.js.map