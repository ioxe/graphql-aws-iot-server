# graphql-aws-iot-ws-transport

(Work in progress!)
An adaptation of the apollographql/subscriptions-transport-ws to support queries, mutations and subscriptions using AWS iot websockets.

Serverless architecture

## Server

### Overview
Lambda gets invoked based on aws iot rule.
Lambda instantiate server 
Handle graphql socket messages via onMessage function by passing the parsedMessage and clientId (uuid required for mqtt websockets)

### Source Code
graphql-aws-iot-ws-transport/src/server.ts

### Setup
1. Your application needs to have an aws iot rule setup which 

Import the server 
