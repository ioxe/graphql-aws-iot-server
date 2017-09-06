import * as AWS from 'aws-sdk';

export interface SubscriptionPrunerOptions {
    subscriptionsTableName: string;
    clientIdtoSubscriptionsIndex: string;
}

export class SubscriptionPruner {
    db: AWS.DynamoDB.DocumentClient;
    iotData: AWS.IotData;
    tableName: string;
    clientIdtoSubscriptionsIndex: string;
    constructor(options: SubscriptionPrunerOptions) {
        this.db = new AWS.DynamoDB.DocumentClient();
        this.tableName = options.subscriptionsTableName;
        this.clientIdtoSubscriptionsIndex = options.clientIdtoSubscriptionsIndex;
    }

    onEvent(clientId: string) {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            IndexName: this.clientIdtoSubscriptionsIndex,
            KeyConditionExpression: 'clientId = :hkey',
            ExpressionAttributeValues: {
                ':hkey': clientId
            }
        }

        return this.db.query(params).promise().then(res => {
            let promises = [];
            if (res.Items && res.Items.length) {
                res.Items.forEach(item => {
                    const deleteParams = {
                        TableName: this.tableName,
                        Key: {
                            clientId,
                            subscriptionName: item.subscriptionName
                        }
                    }
                    promises.push(this.db.delete(deleteParams).promise())
                });
                return Promise.all(promises);
            }
        });
    }
}