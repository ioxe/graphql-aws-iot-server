"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var graphql_1 = require("graphql");
var Todo = new graphql_1.GraphQLObjectType({
    name: 'Todo',
    description: 'A todo item',
    fields: function () { return ({
        id: {
            type: new graphql_1.GraphQLNonNull(graphql_1.GraphQLID),
            description: 'Db uuid'
        },
        name: {
            type: new graphql_1.GraphQLNonNull(graphql_1.GraphQLString),
            description: 'Unique friendly name for todo item'
        },
        content: {
            type: new graphql_1.GraphQLNonNull(graphql_1.GraphQLString),
            description: 'Content of todo item'
        }
    }); }
});
exports.schema = new graphql_1.GraphQLSchema({
    query: new graphql_1.GraphQLObjectType({
        name: 'Query',
        fields: {
            todos: {
                type: new graphql_1.GraphQLList(Todo),
                description: 'Get Todos',
                resolve: function () {
                    return [
                        {
                            id: '1',
                            name: 'Todo 1',
                            content: 'Todo 1 Content'
                        },
                        {
                            id: '2',
                            name: 'Todo 2',
                            content: 'Todo 2 Content'
                        }
                    ];
                }
            }
        }
    }),
    subscription: new graphql_1.GraphQLObjectType({
        name: 'Subscription',
        fields: {
            todoAdded: {
                type: Todo,
                description: 'New todo added',
                subscribe: function () { }
            }
        }
    })
});
//# sourceMappingURL=schema.js.map