// The named exemptions of the AUTH-01 lint (plan Task 15; spec "Better Auth endpoints", revision 7 (d)): server
// actions that only forward to Better Auth through postToAuth. A listed name is exempt only while its body keeps the
// forwarding-only shape (F1 to F9 in server-action-wrapper.mjs). Adding a forwarder, or widening any list below, is a
// reviewed edit (Bob reviews it like a grant).

// Repo-relative file → the export names that are forwarders. Every other export of these files is checked as usual.
export const FORWARDING_ACTIONS = {
  "apps/web/src/app/(auth)/sign-in/actions.ts": ["signInAction"],
  "apps/web/src/app/(auth)/sign-up/actions.ts": ["signUpAction"],
  "apps/web/src/app/(auth)/two-factor/actions.ts": ["verifyTwoFactorAction"],
  "apps/web/src/app/(app)/actions.ts": ["setActiveWorkspaceAction", "signOutAction"],
  "apps/web/src/app/(app)/settings/security/actions.ts": ["startTwoFactorAction", "confirmTwoFactorAction"],
  "apps/web/src/app/(app)/workspaces/actions.ts": ["createWorkspaceAction"],
};

// F1: the only imports of an exempt file, by module and name. A function import may only be called (F7); a value
// import is plain data; a type import has no runtime value. "Any message constant" is an upper-case export name.
export const ALLOWED_IMPORTS = {
  "@/lib/auth/forward": { functions: ["postToAuth"] },
  "@/lib/auth/session": { functions: ["getCurrentSession"] },
  "@/lib/auth/messages": { functions: ["limitMessage"], values: /^[A-Z][A-Z0-9_]*$/ },
  "@/lib/forms": { functions: ["textField"], values: ["EMPTY_FORM_STATE"], types: ["FormState"] },
  "next/navigation": { functions: ["redirect"], values: ["RedirectType"] },
  "next/cache": { functions: ["refresh"] },
  "node:crypto": { functions: ["randomUUID"] },
  "@crm/core/workspace": { functions: ["toWorkspaceSlug"] },
};

// The one Better Auth call (F2) and the one other await (F3).
export const AUTH_CALL = { module: "@/lib/auth/forward", name: "postToAuth" };
export const SESSION_CALL = { module: "@/lib/auth/session", name: "getCurrentSession" };

// F5: the globals checked code may reference, and the names it may not reference at all.
export const ALLOWED_GLOBALS = ["String", "Array", "URL", "Set", "undefined"];
export const BANNED_NAMES = ["getDb", "withWorkspace", "runInWorkspace", "sql", "db"];

// F4b: the methods allowed on each receiver kind.
export const RECEIVER_METHODS = {
  // A parameter of the listed function or of a helper: form data or a string passed in.
  parameter: ["get", "getAll", "trim", "startsWith", "slice", "filter", "map"],
  // The result of an allowed call or new in the same chain.
  chain: ["trim", "slice", "startsWith", "filter", "map", "get"],
  // A const whose initializer is a regular-expression literal, or new Set([<literals>]).
  regex: ["test"],
  set: ["has"],
  // A const whose initializer is a FormData read.
  form: ["trim", "startsWith", "slice", "filter", "map"],
  // The postToAuth result, or a member read rooted at it: map only, after Array.isArray on the same member.
  auth: ["map"],
};

// Calls whose result is an allowed chain receiver: these function imports and globals, and these methods.
export const CHAIN_FUNCTIONS = ["textField", "randomUUID", "String"];
export const CHAIN_METHODS = ["getAll", "trim", "slice", "filter", "map"];

// F8: the only methods that take an inline callback (an expression-bodied arrow, not async).
export const CALLBACK_METHODS = ["filter", "map"];
