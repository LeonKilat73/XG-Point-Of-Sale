import "server-only";
import { createHash } from "node:crypto";

const PIN_RE = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}
