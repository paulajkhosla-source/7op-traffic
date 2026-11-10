"use client";

import { useEffect, useRef } from "react";
import type { Origin, PostcodeOrigin } from "@/lib/client/settings";
import { CloseIcon } from "./icons";
import { OriginPicker } from "./OriginPicker";

type OriginSheetProps = {
  open: boolean;
  onClose: () => void;
  current: Origin | null;
  recents: PostcodeOrigin[];
};

/** Bottom sheet for changing the start point. A native dialog supplies focus trapping and Escape. */
export function OriginSheet({ open, onClose, current, recents }: OriginSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="origin-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        // The dialog's own box is covered by its content, so a click landing on it is a backdrop click.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="mt-4 flex items-center justify-between">
          <h2 id="origin-sheet-title" className="text-xl font-semibold tracking-tight">
            Where are you leaving from?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="mt-5">{open && <OriginPicker current={current} recents={recents} onChosen={onClose} />}</div>
      </div>
    </dialog>
  );
}
