/** Canonical identity used by HTTP/CLI inputs and the database email trigger. */
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
