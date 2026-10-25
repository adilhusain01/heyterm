// Sends an image dropped or pasted onto a session's pane to HeyTerm, which saves it and pastes its
// path into that session's prompt, the way a terminal does when an image file is dragged into it.

import { toast } from "sonner";
import { pageToken } from "./page-token.ts";

const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function firstImage(files: FileList | null | undefined): File | undefined {
  return [...(files ?? [])].find((file) => imageTypes.includes(file.type));
}

export async function attachImage(sessionName: string, image: File): Promise<void> {
  const response = await fetch(`/attachments?session=${encodeURIComponent(sessionName)}`, {
    method: "POST",
    headers: { "X-HeyTerm-Token": pageToken() ?? "", "Content-Type": image.type },
    body: image,
  }).catch(() => undefined);
  const result = (await response?.json().catch(() => undefined)) as { ok?: boolean; text?: string } | undefined;
  if (response?.ok && result?.ok) toast.success(result.text ?? `Attached the image to ${sessionName}.`);
  else toast.warning(result?.text ?? "The image could not be attached. Is HeyTerm still running?");
}
