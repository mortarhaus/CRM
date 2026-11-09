import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NOT_SET } from "@/lib/auth/messages";

interface FieldProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  // Shown, and announced as the field's description, when the server refused the field.
  error: string | undefined;
  defaultValue?: string;
}

// The hint and the error describe the field (aria-describedby), and a refused field is aria-invalid.
function describedBy(id: string, hint: string | undefined, error: string | undefined): string | undefined {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

function FieldFrame({ id, label, hint, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField(props: FieldProps & { inputMode?: "text" | "decimal" }) {
  const { id, name, hint, error, defaultValue, inputMode = "text" } = props;
  return (
    <FieldFrame {...props}>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FieldFrame>
  );
}

export function SelectField(props: FieldProps & { options: readonly string[] }) {
  const { id, name, hint, error, defaultValue, options } = props;
  return (
    <FieldFrame {...props}>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      >
        {/* Not set yet: posting the empty value leaves it as it is (the action reads "" as no change). */}
        {defaultValue === undefined && <option value="">{NOT_SET}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </FieldFrame>
  );
}
