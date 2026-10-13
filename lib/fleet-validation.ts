import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);

const phone = z
  .string()
  .trim()
  .regex(/^[+0-9()\s-]{8,20}$/, "Enter a valid phone number.");

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid date.")
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

export const driverInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone,
  alternatePhone: phone.optional().nullable().or(z.literal("")).transform((value) => value || null),
  address: optionalText(500),
  licenceNumber: z.string().trim().min(4).max(40).transform((value) => value.toUpperCase()),
  licenceExpiry: optionalDate,
  joiningDate: optionalDate,
  salaryType: z.enum(["PER_LOAD", "DAILY_WAGE", "MONTHLY", "CUSTOM"]),
  ratePerLoad: z.number().finite().min(0).max(10000000),
  baseSalary: z.number().finite().min(0).max(100000000),
  bankOrUpi: optionalText(120),
  emergencyContact: optionalText(100),
  notes: optionalText(1000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const vehicleInput = z.object({
  vehicleNumber: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .transform((value) => value.replace(/\s+/g, "").toUpperCase()),
  vehicleType: z.string().trim().min(2).max(60),
  capacity: z.number().finite().positive().max(100000),
  capacityUnit: z.string().trim().min(1).max(20),
  assignedDriverId: z.string().trim().min(1).optional().nullable().transform((value) => value || null),
  insuranceExpiry: optionalDate,
  fitnessExpiry: optionalDate,
  permitExpiry: optionalDate,
  pollutionExpiry: optionalDate,
  status: z.enum(["AVAILABLE", "ASSIGNED", "UNDER_MAINTENANCE", "INACTIVE"]),
  notes: optionalText(1000),
});

export const loginInput = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});
