import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import QrScanner from "qr-scanner";
import QrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "../lib/utils";

QrScanner.WORKER_PATH = QrScannerWorkerPath;

export type ScanDetectionResult =
  | { ok: true }
  | { ok: false; message: string };

interface ScanQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (value: string) => Promise<ScanDetectionResult> | ScanDetectionResult;
}

export const ScanQrDialog: React.FC<ScanQrDialogProps> = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const detectingRef = useRef(false);
  const { t, locale } = useI18n();
  const [status, setStatus] = useState(t("Point the camera at the QR code."));
  const [error, setError] = useState("");
  const [manualValue, setManualValue] = useState("");
  const isBusy = status === t("Requesting camera...") || status === t("Checking card...");

  useEffect(() => {
    if (!isOpen) return;
    detectingRef.current = false;
    setError("");
    setStatus(t("Requesting camera..."));

    let active = true;
    const handleDetectedValue = async (value: string) => {
      if (!active || detectingRef.current) return;
      detectingRef.current = true;
      setError("");
      setStatus(t("Checking card..."));

      try {
        const result = await onDetected(value);
        if (!active) return;
        if (!result.ok) {
          setError(result.message);
          setStatus(t("Scanning..."));
          detectingRef.current = false;
          return;
        }
        onClose();
      } catch {
        if (!active) return;
        setError(t("Unable to validate this card right now."));
        setStatus(t("Scanning..."));
        detectingRef.current = false;
      }
    };

    const startScanner = async () => {
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setError(t("No camera detected on this device."));
        return;
      }
      if (!videoRef.current) return;

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          void handleDetectedValue(result.data);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      scannerRef.current = scanner;
      await scanner.start();
      if (!active) return;
      setStatus(t("Scanning..."));
    };

    startScanner().catch(() => {
      setError(t("Camera access blocked. Please allow camera permissions."));
    });

    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [isOpen, onDetected, onClose]);

  const handleManualSubmit = async () => {
    if (!manualValue.trim() || detectingRef.current) return;
    detectingRef.current = true;
    setError("");
    setStatus(t("Checking card..."));

    try {
      const result = await onDetected(manualValue.trim());
      if (!result.ok) {
        setError(result.message);
        setStatus(t("Scanning..."));
        detectingRef.current = false;
        return;
      }
      onClose();
    } catch {
      setError(t("Unable to validate this card right now."));
      setStatus(t("Scanning..."));
      detectingRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[100dvh] w-screen max-w-none rounded-none border-0 bg-[#0d1117] p-0 text-white sm:h-[100dvh] sm:max-w-none md:h-[100dvh] lg:h-auto lg:max-w-[720px] lg:rounded-[32px] lg:border lg:border-white/10 lg:bg-[#0d1117]">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-black px-5 pb-5 pt-8 sm:px-6 lg:px-7">
            <DialogHeader className="relative space-y-4 text-left">
              <DialogTitle className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {t("Scan card")}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                  error
                    ? "border-white/20 bg-white/10 text-white"
                    : isBusy
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/20 bg-white/10 text-white"
                )}>
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    error ? "bg-white" : isBusy ? "bg-white/80" : "bg-white"
                  )} />
                  {status}
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6 lg:px-7">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_28px_80px_-36px_rgba(0,0,0,0.75)]">
              <video ref={videoRef} className="h-[48vh] w-full object-cover sm:h-[54vh] lg:h-[420px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_22%,rgba(0,0,0,0.12)_60%,rgba(0,0,0,0.7)_100%)]" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 sm:p-8">
                <div className="relative aspect-square w-full max-w-[21rem] rounded-[32px] border border-white/14 bg-white/[0.03] backdrop-blur-[1px] sm:max-w-[24rem]">
                  <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[32px] border-l-[3px] border-t-[3px] border-white" />
                  <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[32px] border-r-[3px] border-t-[3px] border-white" />
                  <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[32px] border-b-[3px] border-l-[3px] border-white" />
                  <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[32px] border-b-[3px] border-r-[3px] border-white" />
                  <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white to-transparent" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-gradient-to-t from-[#020617] via-[#020617]/92 to-transparent px-4 py-4 text-sm text-white/72 sm:px-5">
                <div className="flex items-center gap-2">
                  <QrCode size={16} className="text-white" />
                  <span>{t("QR code")}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-[22px] border border-white/15 bg-white/8 px-4 py-3 text-sm text-white">
                {error}
              </div>
            )}

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.5)] sm:p-5">
              <div className="mb-3">
                <Label className="text-white">{t("Card code, UUID, or URL")}</Label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder={t("Example: 547a-s5a7, UUID, or URL")}
                  autoCapitalize="off"
                  spellCheck={false}
                  className="h-12 border-white/10 bg-black/25 font-mono text-sm text-white placeholder:text-white/35"
                />
                <Button
                  variant="outline"
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim() || detectingRef.current}
                  className="h-12 rounded-full border-white/15 bg-white/8 px-6 text-white hover:bg-white/14"
                >
                  {t("Open Card")}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 bg-[#0b1220]/92 px-5 py-4 backdrop-blur sm:px-6 lg:px-7">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/12"
            >{t("Close")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
