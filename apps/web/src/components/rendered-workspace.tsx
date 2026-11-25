import { RENDERED_WORKSPACE_FIELD } from "@/lib/forms";

// The workspace the form's page was rendered for. action() refuses the post (WORKSPACE_CHANGED) once the session's
// active workspace is another one; the session alone decides where a write goes (TEN-11).
export function RenderedWorkspace({ id }: { id: string }) {
  return <input type="hidden" name={RENDERED_WORKSPACE_FIELD} value={id} />;
}
