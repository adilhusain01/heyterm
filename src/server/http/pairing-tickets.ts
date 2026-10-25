// How a page gets the token without it ever appearing in an address. The heyterm command opens the
// browser with a ticket (an address is visible to other users of the computer in the process list);
// the page trades the ticket for the token once, within two minutes.

import { randomBytes, timingSafeEqual } from "node:crypto";

const ticketLifetimeMilliseconds = 120_000;

export class PairingTickets {
  private readonly tickets = new Map<string, number>();

  constructor(
    private readonly token: string,
    private readonly now: () => number = Date.now,
  ) {}

  issue(): string {
    const ticket = randomBytes(16).toString("hex");
    this.tickets.set(ticket, this.now() + ticketLifetimeMilliseconds);
    return ticket;
  }

  // The token for a fresh ticket, once; nothing for anything else.
  redeem(ticket: string): string | undefined {
    for (const [known, expiresAt] of this.tickets) {
      if (expiresAt < this.now()) this.tickets.delete(known);
    }
    const match = [...this.tickets.keys()].find((known) => sameText(known, ticket));
    if (!match) return undefined;
    this.tickets.delete(match);
    return this.token;
  }
}

function sameText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
