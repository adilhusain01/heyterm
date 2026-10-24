// Turns waiting for the assistant. What the user says goes ahead of announcements still waiting,
// so a question never sits behind news about the sessions.

export type TurnPriority = "user" | "event";

export class TurnQueue<Turn> {
  private readonly userTurns: Turn[] = [];
  private readonly eventTurns: Turn[] = [];

  add(turn: Turn, priority: TurnPriority): void {
    (priority === "user" ? this.userTurns : this.eventTurns).push(turn);
  }

  next(): Turn | undefined {
    return this.userTurns.shift() ?? this.eventTurns.shift();
  }

  get size(): number {
    return this.userTurns.length + this.eventTurns.length;
  }
}
