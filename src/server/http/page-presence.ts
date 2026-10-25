// Whether HeyTerm should stop because no page is open. Closing the last page on purpose stops it
// after a grace period, so a reload never does; a page that only lost its connection (the Mac
// sleeping, a frozen tab) never does, because it reconnects and the sessions must keep running. Pure.

export interface PagePresenceFacts {
  openPageCount: number;
  pageWasOpen: boolean;
  lastPageLeftOnPurpose: boolean;
  keepRunningWithoutPage: boolean;
}

export class PagePresence {
  static shouldStopSoon(facts: PagePresenceFacts): boolean {
    return facts.openPageCount === 0 && facts.pageWasOpen && facts.lastPageLeftOnPurpose && !facts.keepRunningWithoutPage;
  }
}
