// Whether a socket that looks open is really alive, whether a closed terminal pane connects again,
// and what to tell the user during an outage. After a Mac sleeps, a browser can hold a WebSocket
// that never delivers another message and never fires close, so the page asks the server for a
// reply now and then and drops the socket when none comes. Pure.

export type SocketHealthVerdict = "fine" | "ask" | "waiting" | "dead";
export type OutageNotice = "reconnecting" | "not_answering";
// What dropped a pane: this computer's HeyTerm, or the other computer a "host/name" pane reaches through it.
export type PaneLossCause = "heyterm" | "remote";

const askAfterSilenceMilliseconds = 15_000;
const replyDeadlineMilliseconds = 5_000;
const longestReconnectDelayMilliseconds = 5_000;
const noticeAfterMilliseconds = 5_000;
const notAnsweringAfterMilliseconds = 25_000;
// Codes HeyTerm's server closes a pane with: the session ended, or there is no such session.
const sessionEndedCode = 1000;
const noSuchSessionCode = 4404;
// This computer's HeyTerm closes a remote pane with it when the other computer dropped the pane.
const remoteDroppedCode = 4502;

export class ConnectionHealth {
  static readonly checkEveryMilliseconds = 2_500;

  // askedAt is when the page last asked for a reply, while it is still waiting for one.
  static verdict(lastMessageAt: number, askedAt: number | undefined, now: number): SocketHealthVerdict {
    if (askedAt !== undefined && lastMessageAt < askedAt) return now - askedAt >= replyDeadlineMilliseconds ? "dead" : "waiting";
    return now - lastMessageAt >= askAfterSilenceMilliseconds ? "ask" : "fine";
  }

  static terminalShouldReconnect(closeCode: number): boolean {
    return closeCode !== sessionEndedCode && closeCode !== noSuchSessionCode;
  }

  static paneLossCause(closeCode: number): PaneLossCause {
    return closeCode === remoteDroppedCode ? "remote" : "heyterm";
  }

  static paneLostNotice(cause: PaneLossCause, host: string | undefined): string {
    return `Lost the connection to ${cause === "remote" && host ? host : "HeyTerm"}. Reconnecting...`;
  }

  static reconnectDelay(attempt: number): number {
    return Math.min(longestReconnectDelayMilliseconds, 250 * 2 ** attempt);
  }

  static outageNotice(closedForMilliseconds: number): OutageNotice | undefined {
    if (closedForMilliseconds >= notAnsweringAfterMilliseconds) return "not_answering";
    if (closedForMilliseconds >= noticeAfterMilliseconds) return "reconnecting";
    return undefined;
  }
}
