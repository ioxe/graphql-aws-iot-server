import * as AWS from 'aws-sdk';
export declare class PubSub {
    lambda: AWS.Lambda;
    functionName: string;
    constructor(functionName: string);
    publish(triggerName: string, payload: any): Promise<AWS.Lambda.InvocationResponse>;
}
