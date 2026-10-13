import type { Prisma } from "@prisma/client";

const privateFields = new Set([
  "bankOrUpi",
  "address",
  "alternatePhone",
  "emergencyContact",
  "notes",
]);

function jsonScalar(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

export function auditChanges(
  previous: object | null,
  current: object,
  fields: readonly string[],
): Prisma.InputJsonObject {
  const changes: Record<string, Prisma.InputJsonValue | null> = {};
  for (const field of fields) {
    const before = previous ? Reflect.get(previous, field) : null;
    const after = Reflect.get(current, field);
    changes[field] = privateFields.has(field)
      ? { changed: before !== after }
      : { before: jsonScalar(before), after: jsonScalar(after) };
  }
  return changes;
}
