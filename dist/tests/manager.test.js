"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var manager_1 = require("../src/manager");
var message_types_1 = require("../src/message-types");
var schema_1 = require("./schema");
var mocks_1 = require("./mocks");
describe('Initialization', function () {
    it('initializes with valid parameters', function () {
        var subscriptionManager = new manager_1.SubscriptionManager({
            appPrefix: 'TEST',
            addSubscriptionFunction: function () { return Promise.resolve(null); },
            removeSubscriptionFunction: function () { return Promise.resolve(null); },
            schema: schema_1.schema,
            iotEndpoint: 'testendpoint',
        });
        expect(subscriptionManager).toBeDefined();
    });
    it('throws an error if IotEndpoint is missing', function () {
        var error;
        try {
            var subscriptionManager = new manager_1.SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: function () { return Promise.resolve(null); },
                removeSubscriptionFunction: function () { return Promise.resolve(null); },
                schema: null,
                iotEndpoint: null,
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Iot Endpoint Required');
    });
    it('throws an error if schema is missing', function () {
        var error;
        try {
            var subscriptionManager = new manager_1.SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: function () { return Promise.resolve(null); },
                removeSubscriptionFunction: function () { return Promise.resolve(null); },
                schema: null,
                iotEndpoint: 'testendpoint',
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Schema Required');
    });
    it('throws an error if app prefix is missing', function () {
        var error;
        try {
            var subscriptionManager = new manager_1.SubscriptionManager({
                appPrefix: null,
                addSubscriptionFunction: function () { return Promise.resolve(null); },
                removeSubscriptionFunction: function () { return Promise.resolve(null); },
                schema: schema_1.schema,
                iotEndpoint: 'testendpoint',
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('AppPrefix required');
    });
    it('throws an error if add subscription function is missing', function () {
        var error;
        try {
            var subscriptionManager = new manager_1.SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: null,
                removeSubscriptionFunction: function () { return Promise.resolve(null); },
                schema: schema_1.schema,
                iotEndpoint: 'testendpoint',
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Add Subscription Function Required');
    });
    it('throws an error if remove subscription function is missing', function () {
        var error;
        try {
            var subscriptionManager = new manager_1.SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: function () { return Promise.resolve(null); },
                removeSubscriptionFunction: null,
                schema: schema_1.schema,
                iotEndpoint: 'testendpoint',
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Remove Subscription Function Required');
    });
});
describe('Execution', function () {
    var subscriptionManager;
    var messages;
    beforeEach(function () {
        messages = [];
        subscriptionManager = new manager_1.SubscriptionManager({
            appPrefix: 'TEST',
            addSubscriptionFunction: function (val) { return Promise.resolve(val); },
            removeSubscriptionFunction: function () { return Promise.resolve(null); },
            schema: schema_1.schema,
            iotEndpoint: 'testendpoint',
        });
        // Mock for iotData stores both data and complete messages
        subscriptionManager.iotData = mocks_1.createIotDataMock(subscriptionManager);
    });
    describe('Queries', function () {
        it('produces the expected AWS Iot Publish params for a successful query', function (done) {
            var queryMessage = {
                id: '1',
                type: message_types_1.default.GQL_START,
                payload: {
                    query: 'query Todos { todos { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'Todos'
                }
            };
            var expectedGQL_COMPLETEIotDataParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"complete","id":"1","payload":null}',
                qos: 0
            };
            var expectedGQL_DATAIotDataParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"data","id":"1","payload":{"data":{"todos":[{"id":"1","name":"Todo 1","content":"Todo 1 Content"},{"id":"2","name":"Todo 2","content":"Todo 2 Content"}]}}}',
                qos: 0
            };
            var clientId = '11231241';
            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(function (res) {
                var messages = subscriptionManager.iotData.messages;
                expect(messages.length).toBe(2);
                expect(messages[0]).toEqual(expectedGQL_DATAIotDataParams);
                expect(messages[1]).toEqual(expectedGQL_COMPLETEIotDataParams);
                done();
            });
        });
    });
    describe('Subscriptions', function () {
        it('returns no errors AWS Iot Publish params for a valid subscription', function (done) {
            var queryMessage = {
                id: '1',
                type: message_types_1.default.GQL_START,
                payload: {
                    query: 'subscription TodoAdded { todoAdded { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'TodoAdded'
                }
            };
            var clientId = '11231241';
            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(function (res) {
                var messages = subscriptionManager.iotData.messages;
                expect(messages.length).toBe(0);
                done();
            });
        });
        it('returns expected AWS Iot Publish params for a subscription that does not exist', function (done) {
            var expectedErrorMessageParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"error","id":"1","payload":{"message":[{"message":"Cannot query field \\"todoDoesntExist\\" on type \\"Subscription\\".","locations":[{"line":1,"column":26}]}]}}',
                qos: 0
            };
            var queryMessage = {
                id: '1',
                type: message_types_1.default.GQL_START,
                payload: {
                    query: 'subscription TodoAdded { todoDoesntExist { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'TodoAdded'
                }
            };
            var clientId = '11231241';
            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(function (res) {
                var messages = subscriptionManager.iotData.messages;
                expect(messages.length).toBe(1);
                expect(messages[0]).toEqual(expectedErrorMessageParams);
                done();
            });
        });
        it('calls unsubscribe function and removeSubscriptionFn when a valid stop message is received', function (done) {
            var expectedErrorMessageParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"error","id":"1","payload":{"message":[{"message":"Cannot query field \\"todoDoesntExist\\" on type \\"Subscription\\".","locations":[{"line":1,"column":26}]}]}}',
                qos: 0
            };
            var queryMessage = {
                id: '1',
                type: message_types_1.default.GQL_STOP,
                payload: {
                    variables: {},
                    subscriptionName: 'todoAdded'
                }
            };
            var clientId = '11231241';
            var unsubscribeSpy = jest.spyOn(subscriptionManager, 'unsubscribe');
            var removeSubscriptionFnSpy = jest.spyOn(subscriptionManager, 'unsubscribe');
            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(function (res) {
                expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
                expect(removeSubscriptionFnSpy).toHaveBeenCalledTimes(1);
                done();
            });
        });
    });
});
//# sourceMappingURL=manager.test.js.map