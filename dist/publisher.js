"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var graphql_1 = require("graphql");
var message_types_1 = require("./message-types");
var SubscriptionPublisher = /** @class */ (function () {
    function SubscriptionPublisher(options) {
        var _this = this;
        this.triggerNameToFilterFunctionsMap = {};
        this.triggerNameToSubscriptionNamesMap = {};
        // For each payload yielded from a subscription, map it over the normal
        // GraphQL `execute` function, with `payload` as the rootValue.
        // This implements the "MapSourceToResponseEvent" algorithm described in
        // the GraphQL specification. The `execute` function provides the
        // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
        // "ExecuteQuery" algorithm, for which `execute` is also used.
        // Comment Source: https://github.com/graphql/graphql-js/blob/master/src/subscription/subscribe.js
        this.executeQuery = function (item, payload) {
            var clientId = item.clientId, subscriptionName = item.subscriptionName, subscriptionId = item.subscriptionId, variableValues = item.variableValues, operationName = item.operationName, query = item.query;
            var contextValue = {};
            var document = typeof query !== 'string' ? query : graphql_1.parse(query);
            return graphql_1.execute(_this.schema, document, payload, contextValue, variableValues, operationName).then(function (payload) {
                return _this.sendMessage(clientId, subscriptionId, message_types_1.default.GQL_DATA, payload);
            })
                .catch(function (err) {
                console.log('Error executing payload');
                console.log(JSON.stringify(err));
            });
        };
        this.appPrefix = options.appPrefix;
        this.iotData = new AWS.IotData({ endpoint: options.iotEndpoint });
        this.tableName = options.subscriptionsTableName;
        this.subscriptionToClientIdsIndex = options.subscriptionToClientIdsIndex;
        this.schema = options.schema;
        this.db = new AWS.DynamoDB.DocumentClient();
        if (options.triggerNameToFilterFunctionsMap) {
            this.triggerNameToFilterFunctionsMap = options.triggerNameToFilterFunctionsMap;
        }
        if (!options.triggerNameToSubscriptionNamesMap) {
            throw new Error('Subscription name to triggerNames map is required');
        }
        this.triggerNameToSubscriptionNamesMap = options.triggerNameToSubscriptionNamesMap;
    }
    SubscriptionPublisher.prototype.onEvent = function (triggerName, payload) {
        var _this = this;
        var subscriptions = this.triggerNameToSubscriptionNamesMap[triggerName];
        if (Object.prototype.toString.call(subscriptions) === '[object Array]') {
            var promises_1 = [];
            subscriptions.forEach(function (subscriptionName) {
                promises_1.push(_this.publishForSubscription(subscriptionName, triggerName, payload));
            });
        }
        else {
            return this.publishForSubscription(subscriptions, triggerName, payload);
        }
    };
    SubscriptionPublisher.prototype.publishForSubscription = function (subscriptionName, triggerName, payload) {
        var _this = this;
        var params = {
            TableName: this.tableName,
            IndexName: this.subscriptionToClientIdsIndex,
            KeyConditionExpression: 'subscriptionName = :hkey',
            ExpressionAttributeValues: {
                ':hkey': subscriptionName
            }
        };
        var promises = [];
        return this.db.query(params).promise()
            .then(function (res) {
            console.log(res);
            if (res.Items && res.Items.length) {
                res.Items.forEach(function (item) {
                    if (_this.triggerNameToFilterFunctionsMap[triggerName]) {
                        var execute_1 = _this.triggerNameToFilterFunctionsMap[triggerName](payload, item.variableValues);
                        if (!execute_1)
                            return;
                    }
                    promises.push(_this.executeQuery(item, payload));
                });
            }
            if (!promises.length) {
                promises.push(Promise.resolve(null));
            }
            return Promise.all(promises).then(function (res) {
                return res;
            });
        });
    };
    SubscriptionPublisher.prototype.sendMessage = function (clientId, opId, type, payload) {
        var _this = this;
        var message = {
            type: type,
            id: opId,
            payload: payload,
        };
        var params = {
            topic: this.appPrefix + '/in/' + clientId,
            payload: JSON.stringify(message),
            qos: 0
        };
        return new Promise(function (resolve, reject) {
            _this.iotData.publish(params, function (err, data) {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    };
    return SubscriptionPublisher;
}());
exports.SubscriptionPublisher = SubscriptionPublisher;
//# sourceMappingURL=publisher.js.map