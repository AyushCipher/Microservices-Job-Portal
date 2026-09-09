export interface ServiceMapEnv {
  AUTH_SERVICE_URL?: string;
  UTILS_SERVICE_URL?: string;
  USER_SERVICE_URL?: string;
  JOB_SERVICE_URL?: string;
  PAYMENT_SERVICE_URL?: string;
}

// Maps each API path prefix to the backend service it should be proxied to, falling back to the default local port when no override is set. 
export const resolveServiceMap = (
  env: ServiceMapEnv
): Record<string, string> => ({
  "/api/auth": env.AUTH_SERVICE_URL || "http://localhost:5000",
  "/api/utils": env.UTILS_SERVICE_URL || "http://localhost:5001",
  "/api/user": env.USER_SERVICE_URL || "http://localhost:5002",
  "/api/job": env.JOB_SERVICE_URL || "http://localhost:5003",
  "/api/payment": env.PAYMENT_SERVICE_URL || "http://localhost:5004",
});