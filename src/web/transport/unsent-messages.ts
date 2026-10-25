// Messages the page tried to send while the server was unreachable. A short drop loses nothing;
// after a long one, old words and clicks are dropped, since acting on them late could surprise.

const freshForMilliseconds = 10_000;

export class UnsentMessages {
  private readonly waiting: Array<{ text: string; at: number }> = [];

  add(text: string, now: number): void {
    this.waiting.push({ text, at: now });
  }

  takeFresh(now: number): { fresh: string[]; droppedCount: number } {
    const all = this.waiting.splice(0);
    const fresh = all.filter((message) => now - message.at <= freshForMilliseconds).map((message) => message.text);
    return { fresh, droppedCount: all.length - fresh.length };
  }
}
