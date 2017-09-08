"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var message_types_1 = require("./message-types");
var graphql_1 = require("graphql");
var execution = require('graphql/execution/execute');
var addPath = execution.addPath, assertValidExecutionArguments = execution.assertValidExecutionArguments, buildExecutionContext = execution.buildExecutionContext, buildResolveInfo = execution.buildResolveInfo, getOperationRootType = execution.getOperationRootType, collectFields = execution.collectFields, getFieldDef = execution.getFieldDef, resolveFieldValueOrError = execution.resolveFieldValueOrError;
var is_subscriptions_1 = require("./utils/is-subscriptions");
var SubscriptionServer = /** @class */ (function () {
    function SubscriptionServer(options) {
        var keepAlive = options.keepAlive;
        if (!options.schema) {
            throw new Error('schema required');
        }
        if (!options.subscriptionsTableName) {
            throw new Error('subscriptions state tablename required');
        }
        this.appPrefix = options.appPrefix;
        this.schema = options.schema;
        this.keepAlive = keepAlive;
        this.execute = graphql_1.execute;
        this.iotData = new AWS.IotData({ endpoint: options.iotEndpoint });
        this.addSubscriptionFunction = options.addSubscriptionFunction;
        this.removeSubscriptionFunction = options.removeSubscriptionFunction;
    }
    // unsubscribe using clientId and subscriptionName rather than opId to avoid creating an extra index. 
    SubscriptionServer.prototype.unsubscribe = function (clientId, subscriptionName) {
        return this.removeSubscriptionFunction({ clientId: clientId, subscriptionName: subscriptionName });
    };
    SubscriptionServer.prototype.onMessage = function (parsedMessage, clientId, context) {
        var _this = this;
        var opId = parsedMessage.id;
        console.log('received message');
        console.log(JSON.stringify(parsedMessage));
        switch (parsedMessage.type) {
            case message_types_1.default.GQL_CONNECTION_INIT:
                return this.sendMessage(clientId, undefined, message_types_1.default.GQL_CONNECTION_ACK, undefined);
            case message_types_1.default.GQL_START:
                var params_1 = {
                    query: parsedMessage.payload.query,
                    variables: parsedMessage.payload.variables,
                    operationName: parsedMessage.payload.operationName,
                    context: context,
                    formatResponse: undefined,
                    formatError: undefined,
                    callback: undefined,
                };
                var document_1 = typeof params_1.query !== 'string' ? params_1.query : graphql_1.parse(params_1.query);
                var validationErrors = [];
                validationErrors = graphql_1.validate(this.schema, document_1, this.specifiedRules);
                if (validationErrors.length > 0) {
                    return this.sendError(clientId, opId, { message: validationErrors });
                }
                else if (is_subscriptions_1.isASubscriptionOperation(document_1, params_1.operationName)) {
                    return this.validateSubscription(this.schema, document_1, this.rootValue, params_1.context, params_1.variables, params_1.operationName)
                        .then(function (subscriptionName) {
                        var setSubscriptionParams = {
                            clientId: clientId,
                            query: params_1.query,
                            subscriptionName: subscriptionName,
                            subscriptionId: opId,
                            variableValues: params_1.variables
                        };
                        return _this.addSubscriptionFunction(setSubscriptionParams);
                    });
                }
                else {
                    return this.execute(this.schema, document_1, this.rootValue, params_1.context, params_1.variables, params_1.operationName)
                        .then(function (value) {
                        var result = value;
                        if (params_1.formatResponse) {
                            try {
                                result = params_1.formatResponse(value, params_1);
                            }
                            catch (err) {
                                console.error('Error in formatError function:', err);
                            }
                        }
                        return _this.sendMessage(clientId, opId, message_types_1.default.GQL_DATA, result);
                    })
                        .then(function (_) {
                        return _this.sendMessage(clientId, opId, message_types_1.default.GQL_COMPLETE, null);
                    })
                        .catch(function (err) {
                        if (params_1.formatError) {
                            var error = err;
                            try {
                                error = params_1.formatError(err, params_1);
                            }
                            catch (err) {
                                console.error('Error in formatError function: ', err);
                            }
                            return _this.sendError(clientId, opId, error);
                        }
                    });
                }
            case message_types_1.default.GQL_STOP:
                console.log('stop payload');
                console.log(parsedMessage);
                return this.unsubscribe(clientId, parsedMessage.payload.subscriptionName);
            default:
                return this.sendError(clientId, opId, { message: 'Invalid message type!' });
        }
    };
    SubscriptionServer.prototype.validateSubscription = function (schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
        var assert = assertValidExecutionArguments(schema, document, variableValues);
        var exeContext = buildExecutionContext(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
        var type = getOperationRootType(schema, exeContext.operation);
        var fields = collectFields(exeContext, type, exeContext.operation.selectionSet, Object.create(null), Object.create(null));
        var responseNames = Object.keys(fields);
        var responseName = responseNames[0];
        var fieldNodes = fields[responseName];
        var fieldNode = fieldNodes[0];
        var fieldDef = getFieldDef(schema, type, fieldNode.name.value);
        this.invariant(fieldDef, 'This subscription is not defined by the schema.');
        return Promise.resolve(fieldNode.name.value);
    };
    // Same function as in graphql package
    // Used as part of validate subscription function
    SubscriptionServer.prototype.invariant = function (condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    };
    SubscriptionServer.prototype.sendMessage = function (clientId, opId, type, payload) {
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
        console.log('Send message params', params);
        if (message && clientId) {
            return this.iotData.publish(params).promise();
        }
    };
    SubscriptionServer.prototype.sendError = function (clientId, opId, errorPayload, overrideDefaultErrorType) {
        var sanitizedOverrideDefaultErrorType = overrideDefaultErrorType || message_types_1.default.GQL_ERROR;
        if ([
            message_types_1.default.GQL_CONNECTION_ERROR,
            message_types_1.default.GQL_ERROR,
        ].indexOf(sanitizedOverrideDefaultErrorType) === -1) {
            throw new Error('overrideDefaultErrorType should be one of the allowed error messages' +
                ' GQL_CONNECTION_ERROR or GQL_ERROR');
        }
        return this.sendMessage(clientId, opId, sanitizedOverrideDefaultErrorType, errorPayload);
    };
    return SubscriptionServer;
}());
exports.SubscriptionServer = SubscriptionServer;
//# sourceMappingURL=server.js.map