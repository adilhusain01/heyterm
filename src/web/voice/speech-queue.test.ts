import { describe, expect, it } from "vitest";
import { SpeechQueue } from "./speech-queue.ts";

class FakePlayer {
  played: string[] = [];
  stopped = 0;
  private finish: (() => void) | undefined;
  play(text: string, done: () => void): void {
    this.played.push(text);
    this.finish = done;
  }
  stop(): void {
    this.stopped += 1;
    this.finish = undefined;
  }
  finishCurrent(): void {
    const finish = this.finish;
    this.finish = undefined;
    finish?.();
  }
}

function makeQueue() {
  const player = new FakePlayer();
  const queue = new SpeechQueue(player, { quietAfterInputMilliseconds: 1_500 });
  return { player, queue };
}

describe("SpeechQueue", () => {
  it("says lines one after another instead of cutting one off with the next", () => {
    const { player, queue } = makeQueue();
    queue.enqueue("First.", 0);
    queue.enqueue("Second.", 10);
    expect(player.played).toEqual(["First."]);
    player.finishCurrent();
    queue.tick(20);
    expect(player.played).toEqual(["First.", "Second."]);
    expect(player.stopped).toBe(0);
  });

  it("stops talking the moment the user dictates, and goes on with what is left once they are quiet", () => {
    const { player, queue } = makeQueue();
    queue.enqueue("First.", 0);
    queue.enqueue("Second.", 0);
    queue.noteInput(100);
    expect(player.stopped).toBe(1);
    queue.tick(1_000);
    expect(player.played).toEqual(["First."]);
    queue.tick(1_700);
    expect(player.played).toEqual(["First.", "Second."]);
  });

  it("waits for quiet before starting a line that arrives while the user is talking", () => {
    const { player, queue } = makeQueue();
    queue.noteInput(0);
    queue.enqueue("News.", 200);
    expect(player.played).toEqual([]);
    queue.tick(1_600);
    expect(player.played).toEqual(["News."]);
  });

  it("drops a line that is the same as one waiting, so two arrivals of one event are said once", () => {
    const { player, queue } = makeQueue();
    queue.enqueue("First.", 0);
    queue.enqueue("Same.", 0);
    queue.enqueue("Same.", 0);
    player.finishCurrent();
    queue.tick(10);
    player.finishCurrent();
    queue.tick(20);
    expect(player.played).toEqual(["First.", "Same."]);
  });

  it("forgets everything waiting when cleared, such as when the user mutes", () => {
    const { player, queue } = makeQueue();
    queue.enqueue("First.", 0);
    queue.enqueue("Second.", 0);
    queue.clear();
    player.finishCurrent();
    queue.tick(10);
    expect(player.played).toEqual(["First."]);
    expect(queue.isSpeaking).toBe(false);
  });

  it("moves on when the player never reports the end of a line", () => {
    const { player, queue } = makeQueue();
    queue.enqueue("A long line that the player lost.", 0);
    queue.enqueue("Next.", 0);
    queue.tick(60_000);
    expect(player.played).toEqual(["A long line that the player lost.", "Next."]);
  });
});
