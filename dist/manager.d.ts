import { ExecutionResult, GraphQLSchema, DocumentNode } from 'graphql';
export interface OperationMessagePayload {
    [key: string]: any;
    query?: string;
    variables?: any;
    operationName?: string;
    subscriptionName?: string;
}
export interface OperationMessage {
    payload?: OperationMessagePayload;
    id?: string;
    type: string;
}
export declare type ExecuteFunction = (schema: GraphQLSchema, document: DocumentNode, rootValue?: any, contextValue?: any, variableValues?: {
    [key: string]: any;
}, operationName?: string) => Promise<ExecutionResult>;
export interface ManagerOptions {
    appPrefix: string;
    addSubscriptionFunction: AddSubscriptionFunction;
    removeSubscriptionFunction: RemoveSubscriptionFunction;
    schema: any;
    iotEndpoint: string;
    keepAlive?: number;
}
export interface Subscription {
    clientId: string;
    query: string;
    subscriptionName: string;
    subscriptionId: string;
    variableValues: {
        [key: string]: any;
    };
}
export declare type AddSubscriptionFunction = (params: Subscription) => Promise<any>;
export interface RemoveSubscriptionParams {
    clientId: string;
    subscriptionName: string;
}
export declare type RemoveSubscriptionFunction = (params: RemoveSubscriptionParams) => Promise<void>;
export declare class SubscriptionManager {
    private appPrefix;
    private execute;
    private schema;
    private rootValue;
    private keepAlive;
    private specifiedRules;
    private iotData;
    private addSubscriptionFunction;
    private removeSubscriptionFunction;
    constructor(options: ManagerOptions);
    private unsubscribe(clientId, subscriptionName);
    onMessage(parsedMessage: OperationMessage, clientId: string, context: any): Promise<any>;
    private validateSubscription(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver?);
    private invariant(condition, message);
    private sendMessage(clientId, opId, type, payload);
    private sendError(clientId, opId, errorPayload, overrideDefaultErrorType?);
}
