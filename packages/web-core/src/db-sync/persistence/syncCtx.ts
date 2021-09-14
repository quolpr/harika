export interface ISyncCtx {
  shouldRecordChange: boolean;
  source: 'inDomainChanges' | 'inDbChanges';
}

export interface IInternalSyncCtx extends ISyncCtx {
  windowId: string;
}

export interface ISyncCtx {
  shouldRecordChange: boolean;
  source: 'inDomainChanges' | 'inDbChanges';
}

export interface IInternalSyncCtx extends ISyncCtx {
  windowId: string;
}
