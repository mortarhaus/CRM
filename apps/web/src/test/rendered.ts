import { RENDERED_WORKSPACE_FIELD } from "@/lib/forms";

// An action called as a page rendered for the signed-in workspace calls it: each FormData argument, and a plain input
// object in first place, get the rendered workspace (RenderedWorkspace) unless the test already set one. Tests of the
// refusal itself (workspace-binding.test.ts, action.test.ts) post their own value.
export function rendered<A extends unknown[], R>(run: (...args: A) => R, workspaceId: () => string | undefined) {
  return (...args: A): R => {
    const id = workspaceId() ?? "";
    const bound = args.map((arg, index) => {
      if (arg instanceof FormData) {
        if (!arg.has(RENDERED_WORKSPACE_FIELD)) arg.set(RENDERED_WORKSPACE_FIELD, id);
        return arg;
      }
      if (index === 0 && typeof arg === "object" && arg !== null && !Array.isArray(arg) && !(RENDERED_WORKSPACE_FIELD in arg)) {
        return { [RENDERED_WORKSPACE_FIELD]: id, ...arg };
      }
      return arg;
    }) as A;
    return run(...bound);
  };
}
