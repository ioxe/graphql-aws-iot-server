import MessageTypes from './message-types';

import * as AWS from 'aws-sdk';

const IotData = AWS.IotData;

import isObject = require('lodash.isobject');

import {
    parse,
    ExecutionResult,
    GraphQLSchema,
    DocumentNode,
    validate,
    ValidationContext,
    specifiedRules,
} from 'graphql';

import { executeFromSubscriptionManager } from './adapters/subscription-manager';
import { createEmptyIterable } from './utils/empty-iterable';
import { createAsyncIterator, forAwaitEach, isAsyncIterable } from 'iterall';
import { createIterableFromPromise } from './utils/promise-to-iterable';
import { isASubscriptionOperation } from './utils/is-subscriptions';

import { IncomingMessage } from 'http';

export type ExecutionIterator = AsyncIterator<ExecutionResult>;

// auth0id has to be an index

// tslint:disable
export type ConnectionContext = {
    initPromise?: Promise<any>,
    clientId: string;
    // socket: WebSocket,
    isLegacy: boolean,
    operations: {
        [opId: string]: ExecutionIterator,
    },
};
// tslint:enable

export interface OperationMessagePayload {
    [key: string]: any; // this will support for example any options sent in init like the auth token
    query?: string;
    variables?: any;
    operationName?: string;
}

export interface OperationMessage {
    payload?: OperationMessagePayload;
    variables: any;
    id?: string;
    type: string;
}

export type ExecuteFunction = (schema: GraphQLSchema,
    document: DocumentNode,
    rootValue?: any,
    contextValue?: any,
    variableValues?: { [key: string]: any },
    operationName?: string) => Promise<ExecutionResult> | AsyncIterator<ExecutionResult>;

export type SubscribeFunction = (schema: GraphQLSchema,
    document: DocumentNode,
    rootValue?: any,
    contextValue?: any,
    variableValues?: { [key: string]: any },
    operationName?: string) => AsyncIterator<ExecutionResult>;

export interface ServerOptions {
    APP_PREFIX: string; // app namespace for aws iot
    rootValue?: any;
    schema?: any;
    execute?: ExecuteFunction;
    subscribe?: SubscribeFunction;
    validationRules?: Array<(context: ValidationContext) => any>;
    getConnectionContextFn: Function;
    setConnectionContextFn: Function;
    onOperation?: Function;
    onOperationComplete?: Function;
    onConnect?: Function;
    onDisconnect?: Function;
    keepAlive?: number;
    iotEndpoint: string;
}

export class SubscriptionServer {
    private onOperation: Function;
    // private onOperationComplete?: Function;
    private onConnect: Function;
    private onDisconnect: Function;
    private execute: ExecuteFunction;
    private subscribe: SubscribeFunction;
    private schema: GraphQLSchema;
    private rootValue: any;
    private keepAlive: number;
    private specifiedRules: Array<(context: ValidationContext) => any>;

    // aws iot specific
    private iotData; // iot client
    private APP_PREFIX; // namespace for app topics

    // functions to retrieve connection context from db as there is no state
    getConnectionContextFn: Function;
    setConnectionContextFn: Function;

    constructor(options: ServerOptions) {
        const {
            onOperation, onOperationComplete, onConnect, onDisconnect, keepAlive,
          } = options;

        this.specifiedRules = options.validationRules || specifiedRules;
        this.loadExecutor(options);

        this.onOperation = onOperation;
        // this.onOperationComplete = onOperationComplete;
        this.onConnect = onConnect;
        // this.onDisconnect = onDisconnect;
        this.keepAlive = keepAlive;
        this.iotData = new IotData({ endpoint: options.iotEndpoint });
        this.APP_PREFIX = options.APP_PREFIX;
        this.getConnectionContextFn = options.getConnectionContextFn;
        this.setConnectionContextFn = options.setConnectionContextFn;

        // missing keepalive logic
    }

    private loadExecutor(options: ServerOptions) {
        const { execute, subscribe, schema, rootValue } = options;

        if (subscribe && !execute) {
            throw new Error('Must provide `execute` when providing `subscribe`!');
        }

        if (execute && !schema) {
            throw new Error('Must provide `schema` when using `execute`.');
        }

        this.schema = schema;
        this.rootValue = rootValue;
        this.execute = execute;
        this.subscribe = subscribe;
    }

    private unsubscribe(connectionContext: ConnectionContext, opId: string) {
        if (connectionContext.operations && connectionContext.operations[opId]) {
            if (connectionContext.operations[opId].return) {
                connectionContext.operations[opId].return();
            }
            delete connectionContext.operations[opId];
            return this.setConnectionContextFn(connectionContext);
        }
    }

    private onClose() {
        // Object.keys(connectionContext.operations).forEach((opId) => {
        //     this.unsubscribe(connectionContext, opId);
        // });
    }

    public onMessage(parsedMessage: OperationMessage, clientId: string) {
        return this.getConnectionContextFn(clientId).then((connectionContext: ConnectionContext) => {
            const opId = parsedMessage.id;
            console.log('connection context at start');
            console.log(JSON.stringify(connectionContext));
            console.log('parsedMessage');
            console.log(JSON.stringify(parsedMessage));
            switch (parsedMessage.type) {
                case MessageTypes.GQL_CONNECTION_INIT:
                    let onConnectPromise = Promise.resolve(true);
                    if (this.onConnect) {
                        onConnectPromise = new Promise((resolve, reject) => {
                            try {
                                resolve(this.onConnect(parsedMessage.payload));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    }
                    return connectionContext.initPromise
                        .then((result) => {
                            if (result === false) {
                                throw new Error('Prohibited connection!');
                            }
                            console.log('about to send init message');
                            console.log(connectionContext);
                            return this.sendMessage(
                                connectionContext,
                                undefined,
                                MessageTypes.GQL_CONNECTION_ACK,
                                undefined,
                            );

                            // if (this.keepAlive) {
                            //     this.sendMessage(
                            //         connectionContext,
                            //         undefined,
                            //         MessageTypes.GQL_CONNECTION_KEEP_ALIVE,
                            //         undefined,
                            //     );
                            // }
                        })
                        .catch((error: Error) => {
                            return this.sendError(
                                connectionContext,
                                opId,
                                { message: error.message },
                                MessageTypes.GQL_CONNECTION_ERROR,
                            );

                            // setTimeout(() => {
                            //     connectionContext.socket.close(1011);
                            //   }, 10);
                        });
                case MessageTypes.GQL_CONNECTION_TERMINATE:
                    // connectionContext.socket.close();
                    // is this needed?
                    break;
                case MessageTypes.GQL_START:
                    console.log('gql start');

                    return connectionContext.initPromise.then((initResult) => {
                        console.log('completed init promise');
                        let continuationPromise = Promise.resolve(null);
                        if (connectionContext.operations && connectionContext.operations[opId]) {
                            continuationPromise = continuationPromise.then(() => this.unsubscribe(connectionContext, opId));
                        }
                        return continuationPromise.then(_ => {
                            console.log('completed continuation promise');
                            const baseParams = {
                                query: parsedMessage.payload.query,
                                variables: parsedMessage.payload.variables,
                                operationName: parsedMessage.payload.operationName,
                                context: Object.assign(
                                    {},
                                    isObject(initResult) ? initResult : {},
                                ),
                                formatResponse: <any>undefined,
                                formatError: <any>undefined,
                                callback: <any>undefined,
                            };
                            let promisedParams = Promise.resolve(baseParams);

                            // set an initial mock subscription to only registering opId
                            connectionContext.operations[opId] = createEmptyIterable();

                            if (this.onOperation) {
                                const messageForCallback: any = parsedMessage;
                                promisedParams = Promise.resolve(this.onOperation(messageForCallback, baseParams));
                                // no need to pass socket as third param upgrading is handled by aws iot
                            }

                            return promisedParams.then((params: any) => {
                                console.log('promised params are');
                                console.log(promisedParams);
                                if (typeof params !== 'object') {
                                    const error = `Invalid params returned from onOperation! return values must be an object!`;
                                    this.sendError(connectionContext, opId, { message: error });

                                    throw new Error(error);
                                }
                                const document = typeof baseParams.query !== 'string' ? baseParams.query : parse(baseParams.query);
                                let executionIterable: AsyncIterator<ExecutionResult>;
                                let validationErrors: Error[] = [];

                                if (this.schema) {
                                    // NOTE: This is a temporary condition to support the legacy subscription manager.
                                    // As soon as subscriptionManager support is removed, we can remove the if
                                    // and keep only the validation part.
                                    validationErrors = validate(this.schema, document, this.specifiedRules);
                                }
                                if (validationErrors.length > 0) {
                                    executionIterable = createIterableFromPromise<ExecutionResult>(
                                        Promise.resolve({ errors: validationErrors }),
                                    );
                                } else if (this.subscribe && isASubscriptionOperation(document, params.operationName)) {
                                    executionIterable = this.subscribe(this.schema,
                                        document,
                                        this.rootValue,
                                        params.context,
                                        params.variables,
                                        params.operationName);
                                } else {
                                    const promiseOrIterable = this.execute(this.schema,
                                        document,
                                        this.rootValue,
                                        params.context,
                                        params.variables,
                                        params.operationName);

                                    if (!isAsyncIterable(promiseOrIterable) && promiseOrIterable instanceof Promise) {
                                        executionIterable = createIterableFromPromise<ExecutionResult>(promiseOrIterable);
                                    } else if (isAsyncIterable(promiseOrIterable)) {
                                        executionIterable = promiseOrIterable as any;
                                    } else {
                                        // Unexpected return value from execute - log it as error and trigger an error to client side
                                        console.error('Invalid `execute` return type! Only Promise or AsyncIterable are valid values!');

                                        return this.sendError(connectionContext, opId, {
                                            message: 'GraphQL execute engine is not available',
                                        });
                                    }
                                }
                                console.log('starting forawaiteach');
                                forAwaitEach(
                                    createAsyncIterator(executionIterable) as any,
                                    (value: ExecutionResult) => {
                                        let result = value;

                                        if (params.formatResponse) {
                                            try {
                                                result = params.formatResponse(value, params);
                                            } catch (err) {
                                                console.error('Error in formatError function:', err);
                                            }
                                        }
                                        console.log('1st loop of forawaiteach');
                                        return this.sendMessage(connectionContext, opId, MessageTypes.GQL_DATA, result);
                                    })
                                    .then(() => {
                                        console.log('2nd loop of forawaiteach');
                                        return this.sendMessage(connectionContext, opId, MessageTypes.GQL_COMPLETE, null);
                                    })
                                    .catch((e: Error) => {
                                        let error = e;
                                        console.log('error in forawaiteach');
                                        if (params.formatError) {
                                            try {
                                                error = params.formatError(e, params);
                                            } catch (err) {
                                                console.error('Error in formatError function: ', err);
                                            }
                                        }

                                        // plain Error object cannot be JSON stringified.
                                        if (Object.keys(e).length === 0) {
                                            error = { name: e.name, message: e.message };
                                        }

                                        this.sendError(connectionContext, opId, error);
                                    });

                                return executionIterable;
                            }).then((subscription: ExecutionIterator) => {
                                console.log('reached this section');
                                console.log(connectionContext);
                                connectionContext.operations[opId] = subscription;
                                console.log('about to set connection context');
                                return this.setConnectionContextFn(connectionContext).then(res => {
                                    console.log(res);
                                });
                            }).catch((e: any) => {
                                console.log('error in gql start');
                                console.log(e);
                                if (e.errors) {
                                    this.sendMessage(connectionContext, opId, MessageTypes.GQL_DATA, { errors: e.errors });
                                } else {
                                    this.sendError(connectionContext, opId, { message: e.message });
                                }

                                // Remove the operation on the server side as it will be removed also in the client
                                this.unsubscribe(connectionContext, opId);
                                return;
                            });
                        });
                    });
                case MessageTypes.GQL_STOP:
                    connectionContext.initPromise.then(() => {
                        // Find subscription id. Call unsubscribe.
                        return this.unsubscribe(connectionContext, opId);
                    });
                    break;

                default:
                    return this.sendError(connectionContext, opId, { message: 'Invalid message type!' });
            }
        });
    }

    private sendMessage(connectionContext: ConnectionContext, opId: string, type: string, payload: any): void {
        const message = {
            type,
            id: opId,
            payload,
        };

        const params = {
            topic: this.APP_PREFIX + '/in/' + connectionContext.clientId,
            payload: JSON.stringify(message),
            qos: 0
        };

        console.log('send message params', params);

        if (message && connectionContext.clientId) {
            return this.iotData.publish(params).promise();
        }

        // if (parsedMessage && connectionContext.socket.readyState === WebSocket.OPEN) {
        //     connectionContext.socket.send(JSON.stringify(parsedMessage));
        // }
    }

    private sendError(connectionContext: ConnectionContext, opId: string, errorPayload: any,
        overrideDefaultErrorType?: string): void {
        const sanitizedOverrideDefaultErrorType = overrideDefaultErrorType || MessageTypes.GQL_ERROR;
        if ([
            MessageTypes.GQL_CONNECTION_ERROR,
            MessageTypes.GQL_ERROR,
        ].indexOf(sanitizedOverrideDefaultErrorType) === -1) {
            throw new Error('overrideDefaultErrorType should be one of the allowed error messages' +
                ' GQL_CONNECTION_ERROR or GQL_ERROR');
        }

        return this.sendMessage(
            connectionContext,
            opId,
            sanitizedOverrideDefaultErrorType,
            errorPayload,
        );
    }
}
