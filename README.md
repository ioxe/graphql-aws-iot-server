# graphql-aws-iot-ws-transport

(Work in progress!)
An adaptation of the apollographql/subscriptions-transport-ws to support serverless GraphQL queries, mutations and subscriptions using AWS iot websockets.

Serverless architecture

## Architecture

### Graphql API lambda function
  * Uses the Subscription Server class from this ws transport to handled incoming messages from the client.
  * The lambda function can perform any pre execution logic to determine authorization of client based on the clientId. You       are allowed to pass in a custom clientId when instantiating the client. If you are using Cognito for IAM the clientId must     be the identityId (More details in client repo for client flow.)
  * Contains your application specific schema and resolvers for Graphql
  
  Subscription Server Options
  
  ```ts
  export interface ServerOptions {
     appPrefix: string; // App namespace for aws iot
    // rootValue?: any;
    schema: any;
    subscriptionsTableName: string;
    iotEndpoint: string; // iot endpoint for region (i.e. aws iot describe-endpoint --region us-west-2)
    keepAlive?: number; // TODO implications of package with keep alive param    
  }
 
  ```  
  * Currently the server packages uses dynamodb to manage client connections. There you need to create dynamodb table and pass in the subscriptionsTableName in the server options. The Graphql lambda function must have iam permissions to this table.
  
  * Cloudformation example with schema required for subscriptions table. The table has 2 Global Secondary Index (SubscriptionToClientIdsIndex, ClientIdToSubscriptionsIndex). You should enable Dynamodb Autoscaling. You can also create the following table via the AWS console based on the below schema
  ```yaml 
   SubscriptionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      AttributeDefinitions:
        - 
          AttributeName: clientId
          AttributeType: S
        - 
          AttributeName: subscriptionName
          AttributeType: S
      KeySchema:
        - 
          AttributeName: clientId
          KeyType: HASH
        - 
          AttributeName: subscriptionName
          KeyType: RANGE
      ProvisionedThroughput:
        ReadCapacityUnits: 1
        WriteCapacityUnits: 1
      GlobalSecondaryIndexes:
        -
          IndexName: !Ref SubscriptionToClientIdsIndex
          KeySchema:
            - 
              AttributeName: subscriptionName
              KeyType: HASH
          Projection: 
            ProjectionType: 'ALL'
          ProvisionedThroughput:
            ReadCapacityUnits: 1
            WriteCapacityUnits: 1
        -
          IndexName: !Ref ClientIdToSubscriptionsIndex
          KeySchema:
            - 
              AttributeName: clientId
              KeyType: HASH
          Projection: 
            NonKeyAttributes:
              - subscriptionName
            ProjectionType: 'INCLUDE'
          ProvisionedThroughput:
            ReadCapacityUnits: 1
            WriteCapacityUnits: 1
```
  * When the Graphql Lambda function is called, instantiate the SubscriptionServer class and invoke the onMessage method.
  OnMessage takes the parsedMessage, clientId, and graphqlContext as parameters to execute the query, mutation or subscription.
  
  ```
  parsedMessage = JSON.parse(event.data) // payload is sent as a date property by the client
  ```
  The server onMessage function returns a promise to let you know that execution has been completed by the lambda.
  
  ### Subscription Publisher lambda function
  * Responsible for publishing messages when triggers are initiated
  
  Subscription Publisher Options
  ``` ts
  export interface SubscriptionPublisherOptions {
    appPrefix: string;
    iotEndpoint: string;
    subscriptionsTableName: string;
    subscriptionToClientIdsIndex: string;
    triggerNameToFilterFunctionsMap: { [key: string]: any }
    triggerNameToSubscriptionNamesMap: { [key: string]: any }
    schema: GraphQLSchema;
}
  ```
* Iot Endpoint is required to publish new messages. Please run aws iot describe-endpoint --region us-west-2 (change region as required) to get your iot Endpoint.

* Unlike the servered model there is no long lasting async iterator to handle subscription updates. Hence you need to provide a triggerNameToFilterFunctions Object and a triggerNameToSubscriptionNames Object.

* Similar to the servered model there is a pubsub class that needs to be instantiated. You need to pass in the Subscription Publisher Function Name as a parameter to this class. The pubsub publish method will invoke the Subscription Publisher Lambda function to send messages to the socket

* The server publishes messages to the client in the following format ${AppPrefix}/in/${clientId}.

* In your graphql schema you would use the pubsub class to trigger a subscription event. 

For example you could trigger an event post a successful mutation as shown below:
``` ts
pubsub.publish('NEW_TODO', { teamTodoAdded: input });
```

* Example of triggerToFilterFunctionsMap object
``` js
 triggerNameToFilterFunctionsMap: {
     NEW_TODO: (payload, variables) => {
         return payload.teamTodoAdded.teamName === variables.teamName;
     }
 }
 ```
 * Example of triggerNameToSubscriptionNamesMap object

 ``` js
  triggerNameToSubscriptionNamesMap: {
     NEW_TODO: 'teamTodoAdded'
  }
 ```
* Note for the subscriptions map object there can be multiple subscriptions executed by the same triggerName so you can also pass in an array like below 
  
 ``` js
  triggerNameToSubscriptionNamesMap: {
     NEW_TODO: ['teamTodoAdded', 'teamUpdated']
  }
```
 
 
* The publisher function will then publish messages to the relevant clients.
 
* Currently a fanout mechanism needs to be introduced to handle larger numbers of subscriptions.
 
 
 ### Subscription Pruner lambda function
 
 * Removes subscriptions for client on aws iot lifecycle disconnect event
 
  ``` ts
  export interface SubscriptionPrunerOptions {
    subscriptionsTableName: string;
    clientIdtoSubscriptionsIndex: string;
  }
 ```
 Instantiate the class and use the onEvent method passing in the clientId. The clientId is present as a property of the event object. 
 
 ## Example
* See full example of a todo app at https://github.com/ioxe/graphql-aws-iot-ws-transport-example. 
* See cloudformation stack for full infrastructure configuration for example app (https://github.com/ioxe/graphql-aws-iot-ws-transport-example/blob/master/backend/todo-backend.yaml)
 



