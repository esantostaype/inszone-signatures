// src/stores/toastStore.ts
import { toast } from "react-toastify";

export const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
  toast[type](message);
};