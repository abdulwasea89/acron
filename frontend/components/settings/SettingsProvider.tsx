"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SettingsDialog } from "./SettingsDialog";

/* ── Settings dialog ──────────────────────────────────────────────────────
   Settings opens as a modal (like Notion) rather than a page, so it can be
   reached from the workspace menu or the sidebar without losing your place.
   The content is the shared SettingsView. */

interface SettingsDialogValue {
  open: () => void;
}

const SettingsDialogContext = createContext<SettingsDialogValue | null>(null);

/** Lets any descendant open the settings modal. */
export function useSettingsDialog(): SettingsDialogValue | null {
  return useContext(SettingsDialogContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
      {isOpen && <SettingsDialog onClose={() => setIsOpen(false)} />}
    </SettingsDialogContext.Provider>
  );
}
