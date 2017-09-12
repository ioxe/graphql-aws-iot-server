import * as AWS from 'aws-sdk';
export declare class PubSub {
    private lambda;
    private functionName;
    constructor(functionName: string);
    publish(triggerName: string, payload: any): Promise<AWS.Lambda.InvocationResponse>;
}
