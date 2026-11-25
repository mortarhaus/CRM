// What a server action hands back to its form: the message to show, and the submitted values to put
// back in the fields (never a password or a code), so a submit without JavaScript keeps them too.
export interface FormState {
  error: string | null;
  fields: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = { error: null, fields: {} };

export function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

// The hidden field (or input key) that names the workspace a page was rendered for; action() refuses a post whose
// value is not the session's active workspace (WORKSPACE_CHANGED).
export const RENDERED_WORKSPACE_FIELD = "workspaceId";
