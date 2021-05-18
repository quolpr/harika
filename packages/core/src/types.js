export var DatabaseChangeType;
(function (DatabaseChangeType) {
    DatabaseChangeType[DatabaseChangeType["Create"] = 1] = "Create";
    DatabaseChangeType[DatabaseChangeType["Update"] = 2] = "Update";
    DatabaseChangeType[DatabaseChangeType["Delete"] = 3] = "Delete";
})(DatabaseChangeType || (DatabaseChangeType = {}));
export var MessageType;
(function (MessageType) {
    MessageType["Event"] = "event";
    MessageType["Command"] = "command";
})(MessageType || (MessageType = {}));
// Client
export var CommandTypesFromClient;
(function (CommandTypesFromClient) {
    CommandTypesFromClient["ApplyNewChanges"] = "applyNewChanges";
    CommandTypesFromClient["InitializeClient"] = "initializeClient";
    CommandTypesFromClient["SubscribeClientToChanges"] = "subscribeClientToChanges";
})(CommandTypesFromClient || (CommandTypesFromClient = {}));
// Server
export var EventTypesFromServer;
(function (EventTypesFromServer) {
    EventTypesFromServer["CommandHandled"] = "commandHandled";
})(EventTypesFromServer || (EventTypesFromServer = {}));
export var CommandTypesFromServer;
(function (CommandTypesFromServer) {
    CommandTypesFromServer["ApplyNewChanges"] = "applyNewChanges";
})(CommandTypesFromServer || (CommandTypesFromServer = {}));
