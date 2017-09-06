import * as AWS from 'aws-sdk';
import { execute, parse, GraphQLSchema } from 'graphql';
import MessageTypes from './message-types';

// TODO incorporate fanout logic 

export interface SubscriptionPublisherOptions {
    appPrefix: string;
    iotEndpoint: string;
    subscriptionsTableName: string;
    subscriptionToClientIdsIndex: string;
    triggerNameToFilterFunctionsMap: { [key: string]: any }
    triggerNameToSubscriptionNamesMap: { [key: string]: any }
    schema: GraphQLSchema;
}

export class SubscriptionPublisher {
    appPrefix: string;
    iotData: AWS.IotData;
    tableName: string;
    schema: GraphQLSchema;
    db: AWS.DynamoDB.DocumentClient;
    subscriptionToClientIdsIndex: string;
    triggerNameToFilterFunctionsMap = {};
    triggerNameToSubscriptionNamesMap = {};

    constructor(options: SubscriptionPublisherOptions) {
        this.appPrefix = options.appPrefix;
        this.iotData = new AWS.IotData({ endpoint: options.iotEndpoint });
        this.tableName = options.subscriptionsTableName;
        this.subscriptionToClientIdsIndex = options.subscriptionToClientIdsIndex;
        this.schema = options.schema;
        this.db = new AWS.DynamoDB.DocumentClient();
        if (options.triggerNameToFilterFunctionsMap) {
            this.triggerNameToFilterFunctionsMap = options.triggerNameToFilterFunctionsMap;
        }
        if (!options.triggerNameToSubscriptionNamesMap) {
            throw new Error('Subscription name to triggerNames map is required');
        }
        this.triggerNameToSubscriptionNamesMap = options.triggerNameToSubscriptionNamesMap;
    }

    public onEvent(triggerName: string, payload: any) {
        let subscriptions = this.triggerNameToSubscriptionNamesMap[triggerName];
        if (Object.prototype.toString.call(subscriptions) === '[object Array]') {
            let promises = [];
            subscriptions.forEach(subscriptionName => {
                promises.push(this.publishForSubscription(subscriptionName, triggerName, payload))
            });
        } else {
          return this.publishForSubscription(subscriptions, triggerName, payload);   
        }
    }

    publishForSubscription(subscriptionName: string, triggerName: string, payload: any) {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            IndexName: this.subscriptionToClientIdsIndex,
            KeyConditionExpression: 'subscriptionName = :hkey',
            ExpressionAttributeValues: {
                ':hkey': subscriptionName
            }
        }

        const promises = [];

        return this.db.query(params).promise()
            .then(res => {
                console.log(res);
                if (res.Items && res.Items.length) {
                    res.Items.forEach(item => {
                        if (this.triggerNameToFilterFunctionsMap[triggerName]) {
                            const execute = this.triggerNameToFilterFunctionsMap[triggerName](payload, item.variableValues);
                            if (!execute) return;
                        }
                        promises.push(this.executeQuery(item, payload));
                    })
                }
                if (!promises.length) {
                    promises.push(Promise.resolve(null));
                }
                return Promise.all(promises).then(res => {
                    console.log('execution results');
                    console.log(res);
                    return res;
                });
            });
    }


    // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.
    // Comment Source: https://github.com/graphql/graphql-js/blob/master/src/subscription/subscribe.js

    private executeQuery = (item, payload) => {
        const { clientId, subscriptionName, subscriptionId, variableValues, operationName, query } = item;
        const contextValue = {};
        const document = typeof query !== 'string' ? query : parse(query);

        return execute(
            this.schema,
            document,
            payload,
            contextValue,
            variableValues,
            operationName
        ).then(payload => {
            console.log('execution result');
            console.log(payload);
            this.sendMessage(clientId, subscriptionId, MessageTypes.GQL_DATA, payload);
        })
            .catch(err => {
                console.log('Error executing payload');
                console.log(JSON.stringify(err));
            })
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

        return new Promise((resolve, reject) => {
            this.iotData.publish(params, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    }
}
