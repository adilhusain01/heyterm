// Lines to say, one after another. A new line waits its turn instead of cutting off the one being
// said; the user dictating stops the voice at once, and what is left resumes once they are quiet.

export interface SpeechPlayer {
  // Calls done when the line has been said.
  play(text: string, done: () => void): void;
  stop(): void;
}

// A rough speaking rate, to move on if a player never says it finished.
const millisecondsPerCharacter = 90;
const lostLineSlackMilliseconds = 5_000;

export class SpeechQueue {
  private readonly waiting: string[] = [];
  private current: { text: string; giveUpAt: number } | undefined;
  private lastInputAt = Number.NEGATIVE_INFINITY;
  onSpeakingChange: (speaking: boolean) => void = () => undefined;

  constructor(
    private readonly player: SpeechPlayer,
    private readonly options: { quietAfterInputMilliseconds: number },
  ) {}

  get isSpeaking(): boolean {
    return this.current !== undefined;
  }

  enqueue(text: string, now: number): void {
    const line = text.trim();
    if (!line || this.waiting.includes(line) || this.current?.text === line) return;
    this.waiting.push(line);
    this.tick(now);
  }

  // The user is dictating: stop talking now, and say nothing until they are quiet again.
  noteInput(now: number): void {
    this.lastInputAt = now;
    if (!this.current) return;
    this.current = undefined;
    this.player.stop();
    this.onSpeakingChange(false);
  }

  clear(): void {
    this.waiting.length = 0;
    if (!this.current) return;
    this.current = undefined;
    this.player.stop();
    this.onSpeakingChange(false);
  }

  // Called often; starts the next line when nothing is being said and the user is quiet.
  tick(now: number): void {
    if (this.current && now >= this.current.giveUpAt) this.current = undefined;
    if (this.current || this.waiting.length === 0) return;
    if (now - this.lastInputAt < this.options.quietAfterInputMilliseconds) return;
    const text = this.waiting.shift()!;
    const line = { text, giveUpAt: now + text.length * millisecondsPerCharacter + lostLineSlackMilliseconds };
    this.current = line;
    this.onSpeakingChange(true);
    this.player.play(text, () => {
      if (this.current !== line) return;
      this.current = undefined;
      this.onSpeakingChange(this.waiting.length > 0);
    });
  }
}
