import React from "react";
import { AlertTriangle, Check, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "warning" | "danger";
  details?: string[];
  isProcessing?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  details,
  isProcessing = false,
  children,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const btnBg =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-[#3525cd] hover:bg-[#4f46e5] text-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#3525cd] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#131b2e]">{title}</h3>
              <p className="mt-1 text-sm text-[#464555] leading-relaxed">{description}</p>
            </div>
          </div>

          {details && details.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 space-y-1.5 font-mono">
              {details.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#3525cd]">•</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          )}

          {children && <div className="mt-4">{children}</div>}
        </div>

        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${btnBg}`}
          >
            {isProcessing ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{isProcessing ? "Processing..." : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
