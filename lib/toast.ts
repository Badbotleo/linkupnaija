// Tiny imperative toast store — call toast.success/error/info() from anywhere.
export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function emit(type: ToastType, message: string) {
  const item: ToastItem = { id: nextId++, type, message };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
