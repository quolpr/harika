"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandTypesFromServer = exports.EventTypesFromServer = exports.CommandTypesFromClient = exports.MessageType = exports.DatabaseChangeType = void 0;
var DatabaseChangeType;
(function (DatabaseChangeType) {
    DatabaseChangeType[DatabaseChangeType["Create"] = 1] = "Create";
    DatabaseChangeType[DatabaseChangeType["Update"] = 2] = "Update";
    DatabaseChangeType[DatabaseChangeType["Delete"] = 3] = "Delete";
})(DatabaseChangeType = exports.DatabaseChangeType || (exports.DatabaseChangeType = {}));
var MessageType;
(function (MessageType) {
    MessageType["Event"] = "event";
    MessageType["Command"] = "command";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
// Client
var CommandTypesFromClient;
(function (CommandTypesFromClient) {
    CommandTypesFromClient["ApplyNewChanges"] = "applyNewChanges";
    CommandTypesFromClient["InitializeClient"] = "initializeClient";
    CommandTypesFromClient["SubscribeClientToChanges"] = "subscribeClientToChanges";
})(CommandTypesFromClient = exports.CommandTypesFromClient || (exports.CommandTypesFromClient = {}));
// Server
var EventTypesFromServer;
(function (EventTypesFromServer) {
    EventTypesFromServer["CommandHandled"] = "commandHandled";
})(EventTypesFromServer = exports.EventTypesFromServer || (exports.EventTypesFromServer = {}));
var CommandTypesFromServer;
(function (CommandTypesFromServer) {
    CommandTypesFromServer["ApplyNewChanges"] = "applyNewChanges";
})(CommandTypesFromServer = exports.CommandTypesFromServer || (exports.CommandTypesFromServer = {}));
