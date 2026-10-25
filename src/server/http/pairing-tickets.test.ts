import { describe, expect, it } from "vitest";
import { PairingTickets } from "./pairing-tickets.ts";

describe("PairingTickets", () => {
  it("gives the token once for a fresh ticket", () => {
    const tickets = new PairingTickets("the-token", () => 0);
    const ticket = tickets.issue();
    expect(tickets.redeem(ticket)).toBe("the-token");
    expect(tickets.redeem(ticket)).toBeUndefined();
  });

  it("refuses a ticket after two minutes", () => {
    let now = 0;
    const tickets = new PairingTickets("the-token", () => now);
    const ticket = tickets.issue();
    now = 120_001;
    expect(tickets.redeem(ticket)).toBeUndefined();
  });

  it("refuses anything it did not issue", () => {
    const tickets = new PairingTickets("the-token", () => 0);
    tickets.issue();
    expect(tickets.redeem("guess")).toBeUndefined();
    expect(tickets.redeem("")).toBeUndefined();
  });
});
