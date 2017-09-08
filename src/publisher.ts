import * as AWS from 'aws-sdk';
import { execute, parse, GraphQLSchema } from 'graphql';
import { Subscription } from '../src/manager';
import MessageTypes from './message-types';

export interface SubscriptionPublisherOptions {
    appPrefix: string;
    iotEndpoint: string;
    schema: GraphQLSchema;
}

export class SubscriptionPublisher {
    appPrefix: string;
    iotData: AWS.IotData;
    schema: GraphQLSchema;

    constructor(options: SubscriptionPublisherOptions) {
        if (!options.iotEndpoint) {
            throw new Error('Iot Endpoint Required')
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

    // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.
    // Comment Source: https://github.com/graphql/graphql-js/blob/master/src/subscription/subscribe.js


    public executeQueriesAndSendMessages = (subscriptions: Subscription[] | Subscription, payload) => {
        // execute an array of queries batching by identical execution
        if (Object.prototype.toString.call(subscriptions) === '[object Array]') {
            let promises = [];
            let subscriptionsGroupedByIdenticalExecution = this.groupByIdenticalExecutions(subscriptions);
            subscriptionsGroupedByIdenticalExecution.forEach(group => {
                promises.push(
                    this.executeSubscription(group[0], payload)
                        .then(executionResult => {
                            let sendMessagePromises = [];
                            group.forEach(subscription => {
                                const { clientId, subscriptionId } = subscription;
                                sendMessagePromises.push(this.sendMessage(clientId, subscriptionId, MessageTypes.GQL_DATA, executionResult));
                            });
                            return Promise.all(sendMessagePromises);
                        })
                )
            })
            return Promise.all(promises);
        } else {
            // execute only one query
            return this.executeSubscription(subscriptions as Subscription, payload).then(executionResult => {
                const { clientId, subscriptionId } = subscriptions as Subscription;
                return this.sendMessage(clientId, subscriptionId, MessageTypes.GQL_DATA, payload);
            });
        }
    }

    private groupByIdenticalExecutions(subscriptions) {
        return this.groupBy(subscriptions, (subscription) => {
            return [subscription.subscriptionName, subscription.variableValues, subscription.query];
        });
    }

    private sendMessage(clientId: string, opId: string, type: string, payload: any): Promise<any> {
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

        return this.iotData.publish(params).promise();
    }

    private executeSubscription(subscription: Subscription, payload: any) {
        const { clientId, subscriptionName, variableValues, query } = subscription;
        const contextValue = {};
        const document = typeof query !== 'string' ? query : parse(query);
        return execute(
            this.schema,
            document,
            payload,
            contextValue,
            variableValues
        );
    }

    private groupBy(array, f) {
        var groups = {};
        array.forEach(function (o) {
            var group = JSON.stringify(f(o));
            groups[group] = groups[group] || [];
            groups[group].push(o);
        });
        return Object.keys(groups).map(function (group) {
            return groups[group];
        })
    }

}
