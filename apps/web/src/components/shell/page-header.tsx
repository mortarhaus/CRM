import { NewMenu } from "./new-menu";

// The greeting and the primary action above every page, as in the Kinlo sample. The plan's "what needs you" line is
// left out until the document phases have work items to list (plan Task 2: empty until Phase 4 or 5).
// Below sm the action sits on its own line at the left edge, so the New menu's panel always opens inside the viewport.
export function PageHeader({ userName }: { userName: string }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 break-words text-lg font-semibold">Hello, {userName}</p>
      <NewMenu />
    </div>
  );
}
