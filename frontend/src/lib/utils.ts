import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Axios error bodies aren't guaranteed to be our own JSON shape — a cold
// Render service can 502 with an HTML/plain-text body (or no response at
// all on a network failure), and `error.response.data.message` throws in
// that case instead of falling through to a toast.
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Our server may be waking up — please try again in a few seconds."
): string {
  const message = (error as any)?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}