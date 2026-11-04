import "react";

// HTML invoker commands (`command`/`commandfor`) open and close a <dialog> without JavaScript; @types/react 19.3 does
// not list them yet. React passes lowercase attributes through to the DOM unchanged.
declare module "react" {
  // The type parameter must match React's declaration for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ButtonHTMLAttributes<T> {
    command?: "show-modal" | "close" | "request-close" | undefined;
    commandfor?: string | undefined;
  }
}
