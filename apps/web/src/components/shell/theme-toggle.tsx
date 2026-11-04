import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "System theme", Icon: Monitor },
] as const;

// A plain form post to the theme route, so it works without JavaScript; the server re-renders <html> with the class.
export function ThemeToggle({ theme }: { theme: Theme }) {
  return (
    <form action="/theme" method="post" aria-label="Colour theme" className="flex gap-1 rounded-full border border-border bg-card p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="submit"
          name="theme"
          value={value}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className={cn(
            "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            theme === value && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </form>
  );
}
