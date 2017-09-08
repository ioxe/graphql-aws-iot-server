import * as AWS from 'aws-sdk';
import { execute, parse, GraphQLSchema } from 'graphql';
import MessageTypes from './message-types';

// TODO incorporate fanout logic 

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

    public executeQueryAndSendMessage = (item, payload) => {
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
            return this.sendMessage(clientId, subscriptionId, MessageTypes.GQL_DATA, payload);
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
