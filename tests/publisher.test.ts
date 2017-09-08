import { OperationMessage } from '../src/manager';
import { SubscriptionPublisher } from '../src/publisher';
import { schema } from './schema';
import { createIotDataMock } from './mocks';

describe('Initialization', () => {
    it('initializes with valid parameters', () => {
        const subscriptionPublisher = new SubscriptionPublisher({
            appPrefix: 'TEST',
            schema,
            iotEndpoint: 'testendpoint',
        });
        expect(subscriptionPublisher).toBeDefined();
    })

    it('throws an error if IotEndpoint is missing', () => {
        let error;
        try {
            const subscriptionPublisher = new SubscriptionPublisher({
                appPrefix: 'TEST',
                schema,
                iotEndpoint: null,
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Iot Endpoint Required');
    })

    it('throws an error if schema is missing', () => {
        let error;
        try {
            const subscriptionPublisher = new SubscriptionPublisher({
                appPrefix: 'TEST',
                schema: null,
                iotEndpoint: 'testendpoint',
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Schema Required');
    })

    it('throws an error if app prefix is missing', () => {
        let error;
        try {
            const subscriptionPublisher = new SubscriptionPublisher({
                appPrefix: null,
                schema,
                iotEndpoint: 'testendpoint',
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('AppPrefix required');
    })
})

describe('Execution', () => {
    let subscriptionPublisher;
    beforeEach(() => {
        subscriptionPublisher = new SubscriptionPublisher({
            appPrefix: 'TEST',
            schema,
            iotEndpoint: 'testendpoint',
        });
        (subscriptionPublisher as any).iotData = createIotDataMock(subscriptionPublisher)
    })

    it('successfully batches and executes an array of identical client subscriptions', done => {
        const subscriptions = [
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
        ]


        // expected series of iotData params to be sent over the socket
        const expectedIoTDataParamsArray = [{
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
        }]

        const payload = {
            todoAdded: {
                id: '1',
                name: 'Todo 1',
                content: 'Todo 1 Content',
            }
        }

        const executeSpy = jest.spyOn(subscriptionPublisher, 'executeSubscription');
        

        subscriptionPublisher.executeQueriesAndSendMessages(subscriptions, payload)
            .then(res => {
                expect(subscriptionPublisher.iotData.messages).toEqual(expectedIoTDataParamsArray);
                expect(executeSpy).toHaveBeenCalledTimes(1);
                done();
            })
            .catch(err => {
                console.log(err);
                done();
            })
    })

    it('successfully batches and executes an array of mixed (identical + different) client subscriptions', done => {
        const subscriptions = [
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
        ]


        // expected series of iotData params to be sent over the socket
        const expectedIoTDataParamsArray = [{
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
        }]

        const payload = {
            todoAdded: {
                id: '1',
                name: 'Todo 1',
                content: 'Todo 1 Content',
            }
        }

        const executeSpy = jest.spyOn(subscriptionPublisher, 'executeSubscription');
        

        subscriptionPublisher.executeQueriesAndSendMessages(subscriptions, payload)
            .then(res => {
                expect(subscriptionPublisher.iotData.messages).toEqual(expectedIoTDataParamsArray);
                expect(executeSpy).toHaveBeenCalledTimes(2);
                done();
            })
            .catch(err => {
                console.log(err);
                done();
            })
    })
});