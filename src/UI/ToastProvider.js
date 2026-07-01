import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Icon from "./Icon";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const originalAlertRef = useRef(null);
  const originalConfirmRef = useRef(null);

  const removeToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const detectToastType = (message, fallbackType = "info") => {
    const lowerMessage = String(message || "").toLowerCase();

    if (
      lowerMessage.includes("success") ||
      lowerMessage.includes("created") ||
      lowerMessage.includes("updated") ||
      lowerMessage.includes("saved") ||
      lowerMessage.includes("copied") ||
      lowerMessage.includes("uploaded") ||
      lowerMessage.includes("approved") ||
      lowerMessage.includes("removed") ||
      lowerMessage.includes("login successful") ||
      lowerMessage.includes("resume saved") ||
      lowerMessage.includes("prompt copied")
    ) {
      return "success";
    }

    if (
      lowerMessage.includes("failed") ||
      lowerMessage.includes("error") ||
      lowerMessage.includes("required") ||
      lowerMessage.includes("missing") ||
      lowerMessage.includes("could not") ||
      lowerMessage.includes("invalid") ||
      lowerMessage.includes("incorrect") ||
      lowerMessage.includes("blocked") ||
      lowerMessage.includes("not found") ||
      lowerMessage.includes("please complete") ||
      lowerMessage.includes("please enter") ||
      lowerMessage.includes("please select") ||
      lowerMessage.includes("already applied")
    ) {
      return "error";
    }

    return fallbackType;
  };

  const showToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    const cleanMessage =
      typeof message === "string" ? message : "Something happened.";

    const detectedType = detectToastType(cleanMessage, type);

    const newToast = {
      id,
      message: cleanMessage,
      type: detectedType,
    };

    setToasts((current) => [newToast, ...current].slice(0, 5));

    window.setTimeout(
      () => {
        removeToast(id);
      },
      detectedType === "error" ? 5800 : 3800
    );

    return id;
  };

  const closeConfirm = useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || "Please confirm",
        message: String(message || ""),
        confirmLabel: options.confirmLabel || "Continue",
        cancelLabel: options.cancelLabel || "Cancel",
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    originalAlertRef.current = window.alert;
    originalConfirmRef.current = window.confirm;

    window.alert = (message) => {
      showToast(String(message || ""), "info");
    };

    window.rtaToast = showToast;
    window.rtaConfirm = showConfirm;

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }

      if (originalConfirmRef.current) {
        window.confirm = originalConfirmRef.current;
      }

      delete window.rtaToast;
      delete window.rtaConfirm;
    };
  }, [showConfirm]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, showConfirm }}>
      {children}

      {confirmState ? (
        <div className="confirm-overlay" role="presentation">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="confirm-dialog__icon">
              <Icon name="info" size={22} />
            </div>

            <div className="confirm-dialog__copy">
              <h2 id="confirm-dialog-title">{confirmState.title}</h2>
              <p id="confirm-dialog-message">{confirmState.message}</p>
            </div>

            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="confirm-dialog__btn confirm-dialog__btn--ghost"
                onClick={() => closeConfirm(false)}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className="confirm-dialog__btn confirm-dialog__btn--primary"
                autoFocus
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-card ${toast.type}`}
            role="status"
          >
            <div className="toast-icon">
              {toast.type === "success" ? (
                <Icon name="checkCircle" size={18} />
              ) : toast.type === "error" ? (
                <Icon name="ban" size={18} />
              ) : (
                <Icon name="info" size={18} />
              )}
            </div>

            <div className="toast-content">
              <strong>
                {toast.type === "success"
                  ? "Success"
                  : toast.type === "error"
                  ? "Action needed"
                  : "Notice"}
              </strong>

              <p>{toast.message}</p>
            </div>

            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
