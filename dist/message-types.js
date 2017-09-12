"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var MessageTypes = (function () {
    function MessageTypes() {
        throw new Error('Static Class');
    }
    MessageTypes.GQL_CONNECTION_INIT = 'connection_init'; // Client -> Server
    MessageTypes.GQL_CONNECTION_ACK = 'connection_ack'; // Server -> Client
    MessageTypes.GQL_CONNECTION_ERROR = 'connection_error'; // Server -> Client
    // NOTE: This one here don't follow the standard due to connection optimization
    MessageTypes.GQL_CONNECTION_KEEP_ALIVE = 'ka'; // Server -> Client
    MessageTypes.GQL_CONNECTION_TERMINATE = 'connection_terminate'; // Client -> Server
    MessageTypes.GQL_START = 'start'; // Client -> Server
    MessageTypes.GQL_DATA = 'data'; // Server -> Client
    MessageTypes.GQL_ERROR = 'error'; // Server -> Client
    MessageTypes.GQL_COMPLETE = 'complete'; // Server -> Client
    MessageTypes.GQL_STOP = 'stop'; // Client -> Server
    return MessageTypes;
}());
exports.default = MessageTypes;
//# sourceMappingURL=message-types.js.map