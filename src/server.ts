import * as AWS from 'aws-sdk';
import { IncomingMessage } from 'http';

import MessageTypes from './message-types';

import {
    parse,
    execute,
    ExecutionResult,
    GraphQLSchema,
    DocumentNode,
    validate,
    ValidationContext,
    specifiedRules,
} from 'graphql';

const execution = require('graphql/execution/execute');
const {
    addPath,
    assertValidExecutionArguments,
    buildExecutionContext,
    buildResolveInfo,
    getOperationRootType,
    collectFields,
    getFieldDef,
    resolveFieldValueOrError
 } = execution;

import { isASubscriptionOperation } from './utils/is-subscriptions';

export interface OperationMessagePayload {
    [key: string]: any; // this will support for example any options sent in init like the auth token
    query?: string;
    variables?: any;
    operationName?: string;
    subscriptionName?: string;
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
    operationName?: string) => Promise<ExecutionResult>;

export interface ServerOptions {
    appPrefix: string; // app namespace for aws iot
    addSubscriptionFunction: AddSubscriptionFunction // Saves subscription information to desired db. Should return promise. - used in the case of a new subscription being registered
    removeSubscriptionFunction: RemoveSubscriptionFunction // Gets subscription infomration - used in the case of unsubscribe
    // rootValue?: any;
    schema: any;
    subscriptionsTableName: string;
    iotEndpoint: string; // iot endpoint for region (i.e. aws iot describe-endpoint --region us-west-2)
    keepAlive?: number; // TODO implications of package with keep alive param    
}

export interface Subscription {
    clientId: string;
    query: string;
    subscriptionName: string;
    subscriptionId: string;
    variableValues: string;
}

export interface AddSubscriptionParams {
    clientId: string;
    query: string,
    subscriptionName: string,
    subscriptionId: string,
    variableValues: string
}

export type AddSubscriptionFunction = (params: AddSubscriptionParams) => Promise<void>

export interface RemoveSubscriptionParams {
    clientId: string;
    subscriptionName: string,
}

export type RemoveSubscriptionFunction = (params: RemoveSubscriptionParams) => Promise<Subscription>

export class SubscriptionServer {
    private appPrefix; // namespace for app topics    
    private execute: ExecuteFunction;
    private schema: GraphQLSchema;
    private rootValue: any;
    private keepAlive: number;
    private specifiedRules: Array<(context: ValidationContext) => any>;
    private iotData; // iot client
    private addSubscriptionFunction: AddSubscriptionFunction;
    private removeSubscriptionFunction: RemoveSubscriptionFunction;

    constructor(options: ServerOptions) {
        const {
            keepAlive,
          } = options;

        if (!options.schema) {
            throw new Error('schema required');
        }
        if (!options.subscriptionsTableName) {
            throw new Error('subscriptions state tablename required');
        }
        this.appPrefix = options.appPrefix;
        this.schema = options.schema;
        this.keepAlive = keepAlive;
        this.execute = execute;
        this.iotData = new AWS.IotData({ endpoint: options.iotEndpoint });
        this.addSubscriptionFunction = options.addSubscriptionFunction;
        this.removeSubscriptionFunction = options.removeSubscriptionFunction;
    }

    // unsubscribe using clientId and subscriptionName rather than opId to avoid creating an extra index. 
    private unsubscribe(clientId: string, subscriptionName: string) {
        return this.removeSubscriptionFunction({ clientId, subscriptionName });
    }

    public onMessage(parsedMessage: OperationMessage, clientId: string, context) {
        const opId = parsedMessage.id;
        console.log('received message');
        console.log(JSON.stringify(parsedMessage));
        switch (parsedMessage.type) {
            case MessageTypes.GQL_CONNECTION_INIT:
                return this.sendMessage(
                    clientId,
                    undefined,
                    MessageTypes.GQL_CONNECTION_ACK,
                    undefined,
                );
            case MessageTypes.GQL_START:
                const params = {
                    query: parsedMessage.payload.query,
                    variables: parsedMessage.payload.variables,
                    operationName: parsedMessage.payload.operationName,
                    context,
                    formatResponse: <any>undefined,
                    formatError: <any>undefined,
                    callback: <any>undefined,
                };

                const document = typeof params.query !== 'string' ? params.query : parse(params.query);
                let validationErrors: Error[] = [];
                validationErrors = validate(this.schema, document, this.specifiedRules);
                if (validationErrors.length > 0) {
                    return this.sendError(clientId, opId, { message: validationErrors });
                } else if (isASubscriptionOperation(document, params.operationName)) {
                    return this.validateSubscription(
                        this.schema,
                        document,
                        this.rootValue,
                        params.context,
                        params.variables,
                        params.operationName)
                        .then(subscriptionName => {
                            const setSubscriptionParams: Subscription = {
                                clientId,
                                query: params.query,
                                subscriptionName,
                                subscriptionId: opId,
                                variableValues: params.variables
                            }
                            return this.addSubscriptionFunction(setSubscriptionParams);
                        })
                } else {
                    return this.execute(
                        this.schema,
                        document,
                        this.rootValue,
                        params.context,
                        params.variables,
                        params.operationName)
                        .then((value: ExecutionResult) => {
                            let result = value;

                            if (params.formatResponse) {
                                try {
                                    result = params.formatResponse(value, params);
                                } catch (err) {
                                    console.error('Error in formatError function:', err);
                                }
                            }
                            return this.sendMessage(clientId, opId, MessageTypes.GQL_DATA, result);
                        })
                        .then(_ => {
                            return this.sendMessage(clientId, opId, MessageTypes.GQL_COMPLETE, null);
                        })
                        .catch(err => {
                            if (params.formatError) {
                                let error = err;
                                try {
                                    error = params.formatError(err, params);
                                } catch (err) {
                                    console.error('Error in formatError function: ', err);
                                }
                                return this.sendError(clientId, opId, error);
                            }
                        })
                }
            case MessageTypes.GQL_STOP:
                console.log('stop payload');
                console.log(parsedMessage);
                return this.unsubscribe(clientId, parsedMessage.payload.subscriptionName)
            default:
                return this.sendError(clientId, opId, { message: 'Invalid message type!' });
        }
    }

    private validateSubscription(
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver?) {
        let assert = assertValidExecutionArguments(
            schema,
            document,
            variableValues
        );
        const exeContext = buildExecutionContext(
            schema,
            document,
            rootValue,
            contextValue,
            variableValues,
            operationName,
            fieldResolver
        );
        const type = getOperationRootType(schema, exeContext.operation);
        const fields = collectFields(
            exeContext,
            type,
            exeContext.operation.selectionSet,
            Object.create(null),
            Object.create(null)
        );
        const responseNames = Object.keys(fields);
        const responseName = responseNames[0];
        const fieldNodes = fields[responseName];
        const fieldNode = fieldNodes[0];
        const fieldDef = getFieldDef(schema, type, fieldNode.name.value);
        this.invariant(
            fieldDef,
            'This subscription is not defined by the schema.'
        );
        return Promise.resolve(fieldNode.name.value);
    }

    // Same function as in graphql package
    // Used as part of validate subscription function
    private invariant(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    private sendMessage(clientId: string, opId: string, type: string, payload: any): void {
        const message = {
            type,
            id: opId,
            payload,
        };

        const params = {
            topic: this.appPrefix + '/in/' + clientId,
            payload: JSON.stringify(message),
            qos: 0
        };

        console.log('Send message params', params);

        if (message && clientId) {
            return this.iotData.publish(params).promise();
        }
    }

    private sendError(clientId: string, opId: string, errorPayload: any,
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
            clientId,
            opId,
            sanitizedOverrideDefaultErrorType,
            errorPayload,
        );
    }
}
