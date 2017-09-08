"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var publisher_1 = require("../src/publisher");
var schema_1 = require("./schema");
var mocks_1 = require("./mocks");
describe('Initialization', function () {
    it('initializes with valid parameters', function () {
        var subscriptionPublisher = new publisher_1.SubscriptionPublisher({
            appPrefix: 'TEST',
            schema: schema_1.schema,
            iotEndpoint: 'testendpoint',
        });
        expect(subscriptionPublisher).toBeDefined();
    });
    it('throws an error if IotEndpoint is missing', function () {
        var error;
        try {
            var subscriptionPublisher = new publisher_1.SubscriptionPublisher({
                appPrefix: 'TEST',
                schema: schema_1.schema,
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
            var subscriptionPublisher = new publisher_1.SubscriptionPublisher({
                appPrefix: 'TEST',
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
            var subscriptionPublisher = new publisher_1.SubscriptionPublisher({
                appPrefix: null,
                schema: schema_1.schema,
                iotEndpoint: 'testendpoint',
            });
        }
        catch (e) {
            error = e;
        }
        expect(error.message).toEqual('AppPrefix required');
    });
});
describe('Execution', function () {
    var subscriptionPublisher;
    beforeEach(function () {
        subscriptionPublisher = new publisher_1.SubscriptionPublisher({
            appPrefix: 'TEST',
            schema: schema_1.schema,
            iotEndpoint: 'testendpoint',
        });
        subscriptionPublisher.iotData = mocks_1.createIotDataMock(subscriptionPublisher);
    });
    it('successfully batches and executes an array of identical client subscriptions', function (done) {
        var subscriptions = [
            {
                "clientId": "1",
                "query": "subscription TodoAdded  { todoAdded { id    name\n    content\n     __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            },
            {
                "clientId": "2",
                "query": "subscription TodoAdded  { todoAdded { id    name\n    content\n     __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            },
            {
                "clientId": "3",
                "query": "subscription TodoAdded  { todoAdded { id    name\n    content\n     __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            }
        ];
        // expected series of iotData params to be sent over the socket
        var expectedIoTDataParamsArray = [{
                topic: 'TEST/in/1',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","name":"Todo 1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            },
            {
                topic: 'TEST/in/2',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","name":"Todo 1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            },
            {
                topic: 'TEST/in/3',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","name":"Todo 1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            }];
        var payload = {
            todoAdded: {
                id: '1',
                name: 'Todo 1',
                content: 'Todo 1 Content',
            }
        };
        var executeSpy = jest.spyOn(subscriptionPublisher, 'executeSubscription');
        subscriptionPublisher.executeQueriesAndSendMessages(subscriptions, payload)
            .then(function (res) {
            expect(subscriptionPublisher.iotData.messages).toEqual(expectedIoTDataParamsArray);
            expect(executeSpy).toHaveBeenCalledTimes(1);
            done();
        })
            .catch(function (err) {
            console.log(err);
            done();
        });
    });
    it('successfully batches and executes an array of mixed (identical + different) client subscriptions', function (done) {
        var subscriptions = [
            {
                "clientId": "1",
                "query": "subscription TodoAdded  { todoAdded { id   content\n  __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            },
            {
                "clientId": "2",
                "query": "subscription TodoAdded  { todoAdded { id    name\n    content\n     __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            },
            {
                "clientId": "3",
                "query": "subscription TodoAdded  { todoAdded { id    name\n    content\n     __typename\n  }\n}\n",
                "subscriptionId": "2",
                "subscriptionName": "todoAdded",
                "variableValues": {}
            }
        ];
        // expected series of iotData params to be sent over the socket
        var expectedIoTDataParamsArray = [{
                topic: 'TEST/in/1',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            },
            {
                topic: 'TEST/in/2',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","name":"Todo 1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            },
            {
                topic: 'TEST/in/3',
                payload: '{"type":"data","id":"2","payload":{"data":{"todoAdded":{"id":"1","name":"Todo 1","content":"Todo 1 Content","__typename":"Todo"}}}}',
                qos: 0
            }];
        var payload = {
            todoAdded: {
                id: '1',
                name: 'Todo 1',
                content: 'Todo 1 Content',
            }
        };
        var executeSpy = jest.spyOn(subscriptionPublisher, 'executeSubscription');
        subscriptionPublisher.executeQueriesAndSendMessages(subscriptions, payload)
            .then(function (res) {
            expect(subscriptionPublisher.iotData.messages).toEqual(expectedIoTDataParamsArray);
            expect(executeSpy).toHaveBeenCalledTimes(2);
            done();
        })
            .catch(function (err) {
            console.log(err);
            done();
        });
    });
});
//# sourceMappingURL=publisher.test.js.map