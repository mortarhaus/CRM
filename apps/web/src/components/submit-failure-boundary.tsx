"use client";

import { unstable_rethrow } from "next/navigation";
import { Component, type ReactNode } from "react";

interface Props {
  children: (failed: boolean) => ReactNode;
}

interface State {
  error: unknown;
}

// A form whose server action cannot be reached (network loss, a server error) throws to the nearest
// error boundary. For controls in the app header this one keeps the page instead of error.tsx: React
// mounts the form again, told that the last submit failed, so it can show its own retry message. Next's
// redirect and not-found signals pass on to Next.
export class SubmitFailureBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error !== null) unstable_rethrow(this.state.error);
    return this.props.children(this.state.error !== null);
  }
}
