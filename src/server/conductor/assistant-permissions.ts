// How the assistant's own tool calls are allowed. By default it asks out loud exactly when Claude
// Code would (auto mode); with full access, the developer's choice in Setup, it never asks. Either
// way HeyTerm's one rule stays: nothing touches a PrivateKeys folder (a hook, which every mode obeys). Pure.

export type AssistantPermissionChoice = "ask" | "full";

export class AssistantPermissions {
  static mode(choice: AssistantPermissionChoice | undefined): "auto" | "bypassPermissions" {
    return choice === "full" ? "bypassPermissions" : "auto";
  }
}
