const subscriptions = [
    {
        "clientId": "us-west-2:973c709b-4c0b-414e-b77c-61d14319b01e",
        "query": "subscription TeamTodoAdded($teamName: String!) {\n  teamTodoAdded(teamName: $teamName) {\n    id\n    name\n    author\n    content\n    timestamp\n    __typename\n  }\n}\n",
        "subscriptionId": "2",
        "subscriptionName": "teamTodoAdded",
        "variableValues": {
            "teamName": "test"
        }
    },
    {
        "clientId": "us-west-2:a23f67dd-222b-429f-8d6b-ebb9b00404dc",
        "query": "subscription TeamTodoAdded($teamName: String!) {\n  teamTodoAdded(teamName: $teamName) {\n    id\n    name\n    author\n    content\n    timestamp\n    __typename\n  }\n}\n",
        "subscriptionId": "2",
        "subscriptionName": "teamTodoAdded",
        "variableValues": {
            "teamName": "team 2"
        }
    },
    {
        "clientId": "us-west-2:5e974261-75cc-4022-8894-650e811b9f96",
        "query": "subscription TeamTodoAdded($teamName: String!) {\n  teamTodoAdded(teamName: $teamName) {\n    id\n    name\n    author\n    content\n    timestamp\n    __typename\n  }\n}\n",
        "subscriptionId": "2",
        "subscriptionName": "teamTodoAdded",
        "variableValues": {
            "teamName": "test"
        }
    }
]

function groupBy(array, f) {
    var groups = {};
    array.forEach(function (o) {
        var group = JSON.stringify(f(o));
        groups[group] = groups[group] || [];
        groups[group].push(o);
    });
    return Object.keys(groups).map(function (group) {
        return groups[group];
    })
}

const result = groupBy(subscriptions, function (item) {
    return [item.subscriptionName, item.variableValues, item.query];
});

console.log(result);