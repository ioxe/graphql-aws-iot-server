import * as AWS from 'aws-sdk';

export class PubSub {
    lambda: AWS.Lambda;
    functionName: string;
    constructor(functionName: string) {
        this.lambda = new AWS.Lambda();
        this.functionName = functionName;
    }
    publish(triggerName: string, payload: any): Promise<AWS.Lambda.InvocationResponse> {
        const params: AWS.Lambda.InvocationRequest = {
            FunctionName: this.functionName,
            InvocationType: 'Event',
            Payload: JSON.stringify({ triggerName, payload })
        }
        return this.lambda.invoke(params).promise();
    };
}
