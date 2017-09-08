import { SubscriptionManager, OperationMessage } from '../src/manager';
import MessageTypes from '../src/message-types';
import { schema } from './schema';
import { createIotDataMock } from './mocks';

describe('Initialization', () => {
    it('initializes with valid parameters', () => {
        const subscriptionManager = new SubscriptionManager({
            appPrefix: 'TEST',
            addSubscriptionFunction: () => Promise.resolve(null),
            removeSubscriptionFunction: () => Promise.resolve(null),
            schema,
            iotEndpoint: 'testendpoint',
        });
        expect(subscriptionManager).toBeDefined();
    })

    it('throws an error if IotEndpoint is missing', () => {
        let error;
        try {
            const subscriptionManager = new SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: () => Promise.resolve(null),
                removeSubscriptionFunction: () => Promise.resolve(null),
                schema: null,
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
            const subscriptionManager = new SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: () => Promise.resolve(null),
                removeSubscriptionFunction: () => Promise.resolve(null),
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
            const subscriptionManager = new SubscriptionManager({
                appPrefix: null,
                addSubscriptionFunction: () => Promise.resolve(null),
                removeSubscriptionFunction: () => Promise.resolve(null),
                schema,
                iotEndpoint: 'testendpoint',
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('AppPrefix required');
    })

    it('throws an error if add subscription function is missing', () => {
        let error;
        try {
            const subscriptionManager = new SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: null,
                removeSubscriptionFunction: () => Promise.resolve(null),
                schema,
                iotEndpoint: 'testendpoint',
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Add Subscription Function Required');
    })

    it('throws an error if remove subscription function is missing', () => {
        let error;
        try {
            const subscriptionManager = new SubscriptionManager({
                appPrefix: 'TEST',
                addSubscriptionFunction: () => Promise.resolve(null),
                removeSubscriptionFunction: null,
                schema,
                iotEndpoint: 'testendpoint',
            });
        } catch (e) {
            error = e;
        }
        expect(error.message).toEqual('Remove Subscription Function Required');
    })
});

describe('Execution', () => {
    let subscriptionManager;
    let messages;
    beforeEach(() => {
        messages = [];
        subscriptionManager = new SubscriptionManager({
            appPrefix: 'TEST',
            addSubscriptionFunction: (val) => Promise.resolve(val),
            removeSubscriptionFunction: () => Promise.resolve(null),
            schema,
            iotEndpoint: 'testendpoint',
        });

        // Mock for iotData stores both data and complete messages
        (subscriptionManager as any).iotData = createIotDataMock(subscriptionManager)
    })

    describe('Queries', () => {
        it('produces the expected AWS Iot Publish params for a successful query', done => {
            const queryMessage: OperationMessage = {
                id: '1',
                type: MessageTypes.GQL_START,
                payload: {
                    query: 'query Todos { todos { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'Todos'
                }
            }
            const expectedGQL_COMPLETEIotDataParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"complete","id":"1","payload":null}',
                qos: 0
            }

            const expectedGQL_DATAIotDataParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"data","id":"1","payload":{"data":{"todos":[{"id":"1","name":"Todo 1","content":"Todo 1 Content"},{"id":"2","name":"Todo 2","content":"Todo 2 Content"}]}}}',
                qos: 0
            }

            const clientId = '11231241';

            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(res => {
                    const messages = subscriptionManager.iotData.messages;
                    expect(messages.length).toBe(2);
                    expect(messages[0]).toEqual(expectedGQL_DATAIotDataParams)
                    expect(messages[1]).toEqual(expectedGQL_COMPLETEIotDataParams)
                    done();
                });
        });

    });

    describe('Subscriptions', () => {

        it('returns no errors AWS Iot Publish params for a valid subscription', done => {
            const queryMessage: OperationMessage = {
                id: '1',
                type: MessageTypes.GQL_START,
                payload: {
                    query: 'subscription TodoAdded { todoAdded { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'TodoAdded'
                }
            }
            const clientId = '11231241';

            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(res => {
                    const messages = subscriptionManager.iotData.messages;
                    expect(messages.length).toBe(0)
                    done();
                });
        });


        it('returns expected AWS Iot Publish params for a subscription that does not exist', done => {
            const expectedErrorMessageParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"error","id":"1","payload":{"message":[{"message":"Cannot query field \\"todoDoesntExist\\" on type \\"Subscription\\".","locations":[{"line":1,"column":26}]}]}}',
                qos: 0
            }

            const queryMessage: OperationMessage = {
                id: '1',
                type: MessageTypes.GQL_START,
                payload: {
                    query: 'subscription TodoAdded { todoDoesntExist { id\ name \n content\n }}',
                    variables: {},
                    operationName: 'TodoAdded'
                }
            }
            const clientId = '11231241';

            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(res => {
                    const messages = subscriptionManager.iotData.messages;
                    expect(messages.length).toBe(1)
                    expect(messages[0]).toEqual(expectedErrorMessageParams);
                    done();
                });
        });


        it('calls unsubscribe function and removeSubscriptionFn when a valid stop message is received', done => {
            const expectedErrorMessageParams = {
                topic: 'TEST/in/11231241',
                payload: '{"type":"error","id":"1","payload":{"message":[{"message":"Cannot query field \\"todoDoesntExist\\" on type \\"Subscription\\".","locations":[{"line":1,"column":26}]}]}}',
                qos: 0
            }

            const queryMessage: OperationMessage = {
                id: '1',
                type: MessageTypes.GQL_STOP,
                payload: {
                    variables: {},
                    subscriptionName: 'todoAdded'
                }
            }
            const clientId = '11231241';
            const unsubscribeSpy = jest.spyOn(subscriptionManager, 'unsubscribe');
            const removeSubscriptionFnSpy = jest.spyOn(subscriptionManager, 'unsubscribe');

            subscriptionManager.onMessage(queryMessage, clientId, {})
                .then(res => {
                    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
                    expect(removeSubscriptionFnSpy).toHaveBeenCalledTimes(1);
                    done();
                })
        });

    })
})
