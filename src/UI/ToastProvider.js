import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
  } from "react";
  
  const ToastContext = createContext(null);
  
  export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
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
  
    useEffect(() => {
      originalAlertRef.current = window.alert;
      originalConfirmRef.current = window.confirm;
  
      window.alert = (message) => {
        showToast(String(message || ""), "info");
      };
  
      window.rtaToast = showToast;
  
      return () => {
        if (originalAlertRef.current) {
          window.alert = originalAlertRef.current;
        }
  
        if (originalConfirmRef.current) {
          window.confirm = originalConfirmRef.current;
        }
  
        delete window.rtaToast;
      };
    }, []);
  
    return (
      <ToastContext.Provider value={{ showToast, removeToast }}>
        {children}
  
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast-card ${toast.type}`}
              role="status"
            >
              <div className="toast-icon">
                {toast.type === "success"
                  ? "✓"
                  : toast.type === "error"
                  ? "!"
                  : "i"}
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
                ×
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