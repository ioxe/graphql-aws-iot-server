import * as AWS from 'aws-sdk';
import { GraphQLSchema } from 'graphql';
import { Subscription } from '../src/manager';
export interface SubscriptionPublisherOptions {
    appPrefix: string;
    iotEndpoint: string;
    schema: GraphQLSchema;
}
export declare class SubscriptionPublisher {
    appPrefix: string;
    iotData: AWS.IotData;
    schema: GraphQLSchema;
    constructor(options: SubscriptionPublisherOptions);
    executeQueriesAndSendMessages: (subscriptions: Subscription | Subscription[], payload: any) => Promise<any>;
    private groupByIdenticalExecutions(subscriptions);
    private sendMessage(clientId, opId, type, payload);
    private executeSubscription(subscription, payload);
    private groupBy(array, f);
}
