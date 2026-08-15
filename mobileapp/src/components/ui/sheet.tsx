import React from "react";
import { BottomSheet } from "heroui-native/bottom-sheet";

interface SheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/*
  App-wide bottom sheet: heroui's BottomSheet with the platform treatment
  applied once, so every sheet in the app behaves identically.

  - Keyboard-aware. The sheet rides above the keyboard (interactive on iOS,
    resize on Android) and settles back after blur, so inputs and the primary
    action are never covered.
  - Visible grabber: 36×5 rounded pill — the "drag me to dismiss" affordance.
  - Content classes go on `contentContainerClassName`, the BottomSheetView
    children render in. Passing `className` instead styles the gorhom sheet
    root, where padding insets the background surface off the screen edges
    and breaks the sheet's silhouette.
  - Safe-area floor comes from the library's `pb-safe-offset-3` base; don't
    override bottom padding here.
*/
export function Sheet({ isOpen, onOpenChange, children }: SheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="resize"
          handleIndicatorClassName="h-[5px] w-9 rounded-full bg-separator"
          contentContainerClassName="gap-4 px-6"
        >
          {children}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** Sheet heading: 20pt semibold, slightly tightened — Apple's Title 3 weight. */
export function SheetTitle({ children }: { children: React.ReactNode }) {
  return (
    <BottomSheet.Title className="text-[20px] font-semibold leading-[25px] tracking-[-0.4px] text-foreground">
      {children}
    </BottomSheet.Title>
  );
}

/** Supporting line under the title: 14pt muted. */
export function SheetDescription({ children }: { children: React.ReactNode }) {
  return (
    <BottomSheet.Description className="text-[14px] leading-[19px] text-muted">
      {children}
    </BottomSheet.Description>
  );
}
