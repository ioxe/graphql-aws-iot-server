"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var graphql_1 = require("graphql");
var message_types_1 = require("./message-types");
var SubscriptionPublisher = /** @class */ (function () {
    function SubscriptionPublisher(options) {
        var _this = this;
        // For each payload yielded from a subscription, map it over the normal
        // GraphQL `execute` function, with `payload` as the rootValue.
        // This implements the "MapSourceToResponseEvent" algorithm described in
        // the GraphQL specification. The `execute` function provides the
        // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
        // "ExecuteQuery" algorithm, for which `execute` is also used.
        // Comment Source: https://github.com/graphql/graphql-js/blob/master/src/subscription/subscribe.js
        this.executeQueriesAndSendMessages = function (subscriptions, payload) {
            if (!payload) {
                console.log('throwing');
                throw new Error('Payload required');
            }
            // execute an array of queries batching by identical execution
            if (Object.prototype.toString.call(subscriptions) === '[object Array]') {
                var promises_1 = [];
                var subscriptionsGroupedByIdenticalExecution = _this.groupByIdenticalExecutions(subscriptions);
                subscriptionsGroupedByIdenticalExecution.forEach(function (group) {
                    promises_1.push(_this.executeSubscription(group[0], payload)
                        .then(function (executionResult) {
                        var sendMessagePromises = [];
                        group.forEach(function (subscription) {
                            var clientId = subscription.clientId, subscriptionId = subscription.subscriptionId;
                            sendMessagePromises.push(_this.sendMessage(clientId, subscriptionId, message_types_1.default.GQL_DATA, executionResult));
                        });
                        return Promise.all(sendMessagePromises);
                    }));
                });
                return Promise.all(promises_1);
            }
            else {
                // execute only one query
                return _this.executeSubscription(subscriptions, payload).then(function (executionResult) {
                    var _a = subscriptions, clientId = _a.clientId, subscriptionId = _a.subscriptionId;
                    return _this.sendMessage(clientId, subscriptionId, message_types_1.default.GQL_DATA, payload);
                });
            }
        };
        if (!options.iotEndpoint) {
            throw new Error('Iot Endpoint Required');
        }
        if (!options.schema) {
            throw new Error('Schema Required');
        }
        if (!options.appPrefix) {
            throw new Error('AppPrefix required');
        }
        this.appPrefix = options.appPrefix;
        this.iotData = new AWS.IotData({ endpoint: options.iotEndpoint });
        this.schema = options.schema;
    }
    SubscriptionPublisher.prototype.groupByIdenticalExecutions = function (subscriptions) {
        return this.groupBy(subscriptions, function (subscription) {
            return [subscription.subscriptionName, subscription.variableValues, subscription.query];
        });
    };
    SubscriptionPublisher.prototype.sendMessage = function (clientId, opId, type, payload) {
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
        return this.iotData.publish(params).promise();
    };
    SubscriptionPublisher.prototype.executeSubscription = function (subscription, payload) {
        var clientId = subscription.clientId, subscriptionName = subscription.subscriptionName, variableValues = subscription.variableValues, query = subscription.query;
        var contextValue = {};
        var document = typeof query !== 'string' ? query : graphql_1.parse(query);
        return graphql_1.execute(this.schema, document, payload, contextValue, variableValues);
    };
    SubscriptionPublisher.prototype.groupBy = function (array, f) {
        var groups = {};
        array.forEach(function (o) {
            var group = JSON.stringify(f(o));
            groups[group] = groups[group] || [];
            groups[group].push(o);
        });
        return Object.keys(groups).map(function (group) {
            return groups[group];
        });
    };
    return SubscriptionPublisher;
}());
exports.SubscriptionPublisher = SubscriptionPublisher;
//# sourceMappingURL=publisher.js.map