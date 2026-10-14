"use client";

import { Button } from "@/components/ui/button";

// A form whose server action could not be reached (network loss, a server error) lands here.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p role="alert" className="text-sm">
        We couldn&apos;t finish that request. Check your connection and try again.
      </p>
      <Button type="button" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
