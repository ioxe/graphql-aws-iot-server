export default class MessageTypes {
    public static GQL_CONNECTION_INIT = 'connection_init'; // Client -> Server
    public static GQL_CONNECTION_ACK = 'connection_ack'; // Server -> Client
    public static GQL_CONNECTION_ERROR = 'connection_error'; // Server -> Client

    // NOTE: This one here don't follow the standard due to connection optimization
    public static GQL_CONNECTION_KEEP_ALIVE = 'ka'; // Server -> Client
    public static GQL_CONNECTION_TERMINATE = 'connection_terminate'; // Client -> Server
    public static GQL_START = 'start'; // Client -> Server
    public static GQL_DATA = 'data'; // Server -> Client
    public static GQL_ERROR = 'error'; // Server -> Client
    public static GQL_COMPLETE = 'complete'; // Server -> Client
    public static GQL_STOP = 'stop'; // Client -> Server

    constructor() {
        throw new Error('Static Class');
    }
}
