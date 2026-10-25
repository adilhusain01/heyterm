// When the conversation column follows new content, and which requests are new enough to bring into
// view. Pure; ConversationPanel applies them.

// Within this distance of the end, the list counts as read to the bottom and follows new content.
const followDistance = 120;

export class ConversationFollow {
  static isAtEnd({ scrollHeight, scrollTop, clientHeight }: { scrollHeight: number; scrollTop: number; clientHeight: number }): boolean {
    return scrollHeight - scrollTop - clientHeight < followDistance;
  }

  static newRequests(previousKeys: string[], currentKeys: string[]): string[] {
    return currentKeys.filter((key) => !previousKeys.includes(key));
  }
}
