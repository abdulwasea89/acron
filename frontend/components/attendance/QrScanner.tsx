"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * QrScanner — webcam QR reader using @zxing/browser.
 *
 * Rendered through a portal at the top of the stack. The decoder is imported
 * lazily so it never ships in the initial bundle, and it is torn down on unmount
 * or once a code is read. `onResult` receives the decoded text; the caller
 * decides what a valid payload is.
 */
export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (res, _err, ctl) => {
          if (ctl && !controls) controls = ctl;
          if (res && !stopped) {
            stopped = true;
            onResult(res.getText());
            ctl.stop();
          }
        });
      } catch (e) {
        setError(
          e instanceof Error && /permission|denied/i.test(e.message)
            ? "Camera permission was blocked. Allow camera access and try again."
            : "Camera unavailable on this device.",
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onResult]);

  // Escape closes the scanner.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Scan member QR code"
      onClick={onClose}
    >
      <div
        className="animate-dialog-in w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.18_0.01_165)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Scanner</p>
            <h2 className="text-[15px] font-semibold">Scan member QR</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="cursor-pointer rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative mx-5 aspect-square overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

          {/* Framing brackets + scanning line. Decoration only. */}
          {!error && (
            <>
              <div className="pointer-events-none absolute inset-8">
                <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-brand" />
                <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-brand" />
                <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-brand" />
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-brand" />
                <span className="absolute inset-x-0 top-0 h-px animate-[scan_2.2s_ease-in-out_infinite] bg-brand/80 shadow-[0_0_12px_var(--brand)]" />
              </div>
              <style>{`@keyframes scan { 0%,100% { transform: translateY(0); opacity:.4 } 50% { transform: translateY(14rem); opacity:1 } }`}</style>
            </>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-white/80">
              {error}
            </div>
          )}
        </div>

        <p className="px-5 py-4 text-center text-[12px] text-white/60">
          Point the camera at a member&apos;s QR code to check them in.
        </p>
      </div>
    </div>,
    document.body,
  );
}
