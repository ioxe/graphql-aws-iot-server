"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var SubscriptionPruner = /** @class */ (function () {
    function SubscriptionPruner(options) {
        this.db = new AWS.DynamoDB.DocumentClient();
        this.tableName = options.subscriptionsTableName;
        this.clientIdtoSubscriptionsIndex = options.clientIdtoSubscriptionsIndex;
    }
    SubscriptionPruner.prototype.onEvent = function (clientId) {
        var _this = this;
        var params = {
            TableName: this.tableName,
            IndexName: this.clientIdtoSubscriptionsIndex,
            KeyConditionExpression: 'clientId = :hkey',
            ExpressionAttributeValues: {
                ':hkey': clientId
            }
        };
        return this.db.query(params).promise().then(function (res) {
            var promises = [];
            if (res.Items && res.Items.length) {
                res.Items.forEach(function (item) {
                    var deleteParams = {
                        TableName: _this.tableName,
                        Key: {
                            clientId: clientId,
                            subscriptionName: item.subscriptionName
                        }
                    };
                    promises.push(_this.db.delete(deleteParams).promise());
                });
                return Promise.all(promises);
            }
        });
    };
    return SubscriptionPruner;
}());
exports.SubscriptionPruner = SubscriptionPruner;
//# sourceMappingURL=pruner.js.map