"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, INPUT } from "@/components/ui";

export async function libraryMutation(input: Record<string, unknown>) {
  const response = await fetch("/api/me/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data: { error?: string } = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not save. Try again.");
}
export function LibraryMutationButton({
  input,
  children,
}: {
  input: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await libraryMutation(input);
            router.refresh();
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Could not save.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
export function NewListButton() {
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, a[href]",
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open, busy]);
  return (
    <>
      <button
        type="button"
        className={buttonClass()}
        onClick={() => setOpen(true)}
      >
        New list
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !busy && setOpen(false)}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-list-title"
            className="w-full max-w-md rounded-3xl border border-border bg-page p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="new-list-title" className="font-display text-2xl">
              Make room for a new idea
            </h2>
            <p className="mt-2 text-sm text-muted">
              Collect stories you want to return to.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await libraryMutation({
                    action: "createList",
                    name: data.get("name"),
                    description: data.get("description"),
                    isPublic: data.get("isPublic") === "on",
                  });
                  setOpen(false);
                  router.refresh();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Could not create list.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm">
                List name
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={100}
                  placeholder="Ideas worth keeping"
                  className={`${INPUT} mt-2`}
                />
              </label>
              <label className="block text-sm">
                Description <span className="text-muted">(optional)</span>
                <textarea
                  name="description"
                  maxLength={500}
                  rows={3}
                  className={`${INPUT} mt-2 py-3`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="isPublic" type="checkbox" />
                Allow other readers to view and save this list
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className={buttonClass("secondary")}
                >
                  Cancel
                </button>
                <button disabled={busy} className={buttonClass()}>
                  {busy ? "Creating…" : "Create list"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
