// How many columns the grid uses. As few rows as the widest layout needs, then as few columns as
// fill those rows, so four panes sit two by two instead of three in a row and one alone below.

export class GridLayout {
  static columns(paneCount: number, widestColumns: number): number {
    if (paneCount <= 0 || widestColumns <= 1) return 1;
    const rows = Math.ceil(paneCount / widestColumns);
    return Math.ceil(paneCount / rows);
  }
}
