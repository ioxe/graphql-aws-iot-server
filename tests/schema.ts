
import {
    GraphQLSchema,
    GraphQLString,
    GraphQLID,
    GraphQLList,
    GraphQLObjectType,
    GraphQLNonNull,
} from 'graphql';

const Todo = new GraphQLObjectType({
    name: 'Todo',
    description: 'A todo item',
    fields: () => ({
        id: {
            type: new GraphQLNonNull(GraphQLID),
            description: 'Db uuid',
        },
        name: {
            type: new GraphQLNonNull(GraphQLString),
            description: 'Unique friendly name for todo item',
        },
        content: {
            type: new GraphQLNonNull(GraphQLString),
            description: 'Content of todo item',
        },
    }),
});

export const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'Query',
        fields: {
            todos: {
                type: new GraphQLList(Todo),
                description: 'Get Todos',
                resolve: () => {
                    return [
                        {
                            id: '1',
                            name: 'Todo 1',
                            content: 'Todo 1 Content',
                        },
                        {
                            id: '2',
                            name: 'Todo 2',
                            content: 'Todo 2 Content',
                        },
                    ];
                },
            },
        },
    }),
    subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
            todoAdded: {
                type: Todo,
                description: 'New todo added',
                subscribe: () => { },
            },
        },
    }),
});

