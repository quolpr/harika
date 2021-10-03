// The code is taken from https://github.com/roam-unofficial/roam-toolkit/blob/ce48ed748e698ee40975f653a4ddc48c644e4e10/src/ts/core/srs/AnkiScheduler.ts#L95

import { BaseSyncRepository } from '../../../../lib/db/sync/persistence/BaseSyncRepository';

export enum SRSignal {
  AGAIN = 1,
  HARD,
  GOOD,
  EASY,
}

export const SRSignals = [
  SRSignal.AGAIN,
  SRSignal.HARD,
  SRSignal.GOOD,
  SRSignal.EASY,
];

export type ICardDoc = {
  id: string;
  blockId: string;
  nextDate: number;

  interval: number;
  factor: number;

  frontText?: string;

  updatedAt: number;
  createdAt: number;
};
export type ICardRow = ICardDoc;

export type ICard = ICardDoc;

export const cardsTable = 'SRCards' as const;

export class CardsRepository extends BaseSyncRepository<ICardDoc, ICardRow> {
  getTableName() {
    return cardsTable;
  }
}
