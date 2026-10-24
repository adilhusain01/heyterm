// The three things that wait on the user's next words: a send preview, a "which one?" and a "say confirm".

import type { ClarifyView, PreviewView } from "../../shared/protocol.ts";

export const previewMilliseconds = 1_500;
const confirmationMilliseconds = 60_000;

interface PendingPreview extends PreviewView {
  timer: NodeJS.Timeout;
}

interface PendingClarify extends ClarifyView {
  utterance: string;
}

interface PendingConfirmation {
  description: string;
  run: () => Promise<void>;
  // Told when the answer is no, or the request is dropped or replaced.
  onCancel?: () => void;
  expiresAt: number;
}

export class PendingControls {
  preview: PendingPreview | undefined;
  clarify: PendingClarify | undefined;
  private confirmation: PendingConfirmation | undefined;

  constructor(private readonly onChange: () => void) {}

  view(): { preview?: PreviewView; clarify?: ClarifyView; confirmation?: string } {
    const confirmation = this.confirmation && this.confirmation.expiresAt > Date.now() ? this.confirmation.description : undefined;
    const preview = this.preview ? { session: this.preview.session, text: this.preview.text, deadline: this.preview.deadline } : undefined;
    const clarify = this.clarify ? { question: this.clarify.question, options: this.clarify.options } : undefined;
    return { preview, clarify, confirmation };
  }

  startPreview(preview: Omit<PreviewView, "deadline">, onDeadline: () => void): void {
    this.clearPreview();
    const timer = setTimeout(onDeadline, previewMilliseconds);
    this.preview = { ...preview, deadline: Date.now() + previewMilliseconds, timer };
    this.onChange();
  }

  takePreview(): PreviewView | undefined {
    const preview = this.preview;
    this.clearPreview();
    return preview;
  }

  askToClarify(clarify: ClarifyView, utterance: string): void {
    this.clarify = { ...clarify, utterance };
    this.onChange();
  }

  takeClarify(): PendingClarify | undefined {
    const clarify = this.clarify;
    this.clarify = undefined;
    this.onChange();
    return clarify;
  }

  awaitConfirmation(description: string, run: () => Promise<void>, onCancel?: () => void): void {
    this.confirmation?.onCancel?.();
    this.confirmation = { description, run, onCancel, expiresAt: Date.now() + confirmationMilliseconds };
    this.onChange();
  }

  takeConfirmation(): (() => Promise<void>) | undefined {
    const confirmation = this.confirmation;
    this.confirmation = undefined;
    this.onChange();
    return confirmation && confirmation.expiresAt > Date.now() ? confirmation.run : undefined;
  }

  // The thing waiting for "confirm" was done another way, such as a confirm said straight to the permission.
  dropConfirmation(): void {
    if (!this.confirmation) return;
    const dropped = this.confirmation;
    this.confirmation = undefined;
    dropped.onCancel?.();
    this.onChange();
  }

  clearAll(): void {
    this.clearPreview();
    this.clarify = undefined;
    const dropped = this.confirmation;
    this.confirmation = undefined;
    dropped?.onCancel?.();
    this.onChange();
  }

  private clearPreview(): void {
    if (!this.preview) return;
    clearTimeout(this.preview.timer);
    this.preview = undefined;
    this.onChange();
  }
}
