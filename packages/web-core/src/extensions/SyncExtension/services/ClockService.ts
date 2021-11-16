export class ClockService {
  async next() {
    return '';
  }

  async batchNext(count: number): Promise<string[]> {
    return [];
  }

  async updateClock(clock: string) {}

  async initNew() {
    return '';
  }
}
