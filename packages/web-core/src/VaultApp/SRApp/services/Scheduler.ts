import dayjs from 'dayjs';
import { ICard, SRSignal } from '../repositories/CardsRepository';

export type IRepetitionConfig = {
  interval: number;
  factor: number;
};

const maxInterval = 50 * 365;
const minFactor = 1.3;
const hardFactor = 1.2;
const jitterPercentage = 0.05;

const randomFromInterval = (
  min: number,
  max: number, // min and max included
) => Math.random() * (max - min) + min;

export class Scheduler {
  apply(config: IRepetitionConfig, signal: SRSignal) {
    const newConfig: IRepetitionConfig = {
      interval: config.interval,
      factor: config.factor,
    };

    const factorModifier = 0.15;
    switch (signal) {
      case SRSignal.AGAIN:
        newConfig.factor = config.factor - 0.2;
        newConfig.interval = 1;
        break;
      case SRSignal.HARD:
        newConfig.factor = config.factor - factorModifier;
        newConfig.interval = config.interval * hardFactor;
        break;
      case SRSignal.GOOD:
        newConfig.interval = config.interval * config.factor;
        break;
      case SRSignal.EASY:
        newConfig.interval = config.interval * config.factor;
        newConfig.factor = config.factor + factorModifier;
        break;
    }

    return this.enforceLimits(this.addJitter(newConfig));
  }

  private enforceLimits(config: IRepetitionConfig): IRepetitionConfig {
    return {
      interval: Math.min(config.interval, maxInterval),
      factor: Math.max(config.factor, minFactor),
    };
  }

  private addJitter(config: IRepetitionConfig): IRepetitionConfig {
    const jitter = config.interval * jitterPercentage;

    return {
      interval: config.interval + randomFromInterval(-jitter, jitter),
      factor: config.factor,
    };
  }

  static applySignal(card: ICard, signal: SRSignal): ICard {
    const config = new Scheduler().apply(
      {
        interval: card.interval,
        factor: card.factor,
      },
      signal,
    );

    return {
      ...card,
      ...config,
      nextDate: dayjs
        .unix(card.nextDate)
        .add(Math.ceil(config.interval), 'day')
        .unix(),
    };
  }
}
