"use server";

import { isCurrency, MoneyParseError, parseDecimalToMinor } from "@crm/core/money";
import { characterCount, SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_NAME_MAX_LENGTH, SERVICE_UNIT_MAX_LENGTH } from "@crm/core/security";
import { z } from "zod";
import {
  CurrencyLockedError,
  createService,
  type ServiceFields,
  ServiceNotFoundError,
  setServiceArchived,
  StaleServiceError,
  updateService,
} from "@/db/catalog/services";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { echoFields, expectedVersion, requiredText, text } from "@/lib/settings-input";

// A description may run over several lines (line breaks kept, as \n); otherwise as text(): trimmed, no other control
// or format character, at most the limit in code points, empty is none.
const description = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().regex(/^(?:\n|[^\p{Cc}\p{Cf}])*$/u))
  .refine((value) => characterCount(value) <= SERVICE_DESCRIPTION_MAX_LENGTH)
  .transform((value) => (value === "" ? null : value));

// The service as typed (UNI-03). The price is text, read in the chosen currency's exponent by the core parser, never
// through a float (MON-01); empty means no default price. More decimals than the currency has is refused, never
// rounded. The server computes the minor units; nothing the browser computed is trusted (MON-07).
const serviceShape = {
  name: requiredText(SERVICE_NAME_MAX_LENGTH),
  description,
  price: z.string(),
  currency: z.string().refine(isCurrency),
  unit: text(SERVICE_UNIT_MAX_LENGTH),
  taxable: z.boolean(),
};

type ServiceInput = { name: string; description: string | null; price: string; currency: string; unit?: string | null; taxable: boolean };

function toFields(value: ServiceInput, context: z.RefinementCtx): ServiceFields {
  let price: bigint | null = null;
  if (value.price.trim() !== "" && isCurrency(value.currency)) {
    try {
      price = parseDecimalToMinor(value.price, value.currency);
    } catch (error) {
      if (!(error instanceof MoneyParseError)) throw error;
      context.addIssue({ code: "custom", path: ["price"], message: error.reason });
    }
  }
  return {
    name: value.name,
    defaultDescription: value.description,
    defaultUnitPriceMinor: price,
    currency: value.currency,
    unit: value.unit ?? null,
    defaultTaxable: value.taxable,
  };
}

const createInput = z.strictObject(serviceShape).transform((value, context) => toFields(value, context));
const updateInput = z
  .strictObject({ id: z.uuid(), expectedVersion, ...serviceShape })
  .transform(({ id, expectedVersion: version, ...value }, context) => ({ id, version, fields: toFields(value, context) }));
const archiveInput = z.strictObject({ id: z.uuid(), expectedVersion, archived: z.boolean() });

const serviceFromForm = (form: FormData) => ({
  name: form.get("name"),
  description: form.get("description"),
  price: form.get("price"),
  currency: form.get("currency"),
  unit: form.get("unit"),
  // An unticked checkbox is not posted.
  taxable: form.get("taxable") === "on",
});

// Shown again on a refused form posted without JavaScript: none is personal data or a secret.
const echo = (form: FormData) => echoFields(form, ["name", "description", "price", "currency", "unit", "taxable"]);

function refuse(error: unknown): never {
  if (error instanceof StaleServiceError) throw new ActionRefusedError("STALE_VERSION");
  if (error instanceof ServiceNotFoundError) throw new ActionRefusedError("NOT_FOUND");
  if (error instanceof CurrencyLockedError) throw new ActionRefusedError("CURRENCY_LOCKED");
  throw error;
}

// The catalog is Admin and Owner (spec line 792); Staff are refused with FORBIDDEN. Each change is audited with the
// row before and after (services.ts). Never a delete (plan Q22).
export const createServiceAction = action({
  name: "catalog.service.create",
  minRole: "admin",
  input: createInput,
  fromForm: serviceFromForm,
  echo,
  idempotent: false,
  handler: async (ctx, fields) => {
    const created = await createService(ctx.tx, fields, ctx.userId);
    return { id: created.id, version: created.version };
  },
});

export const updateServiceAction = action({
  name: "catalog.service.update",
  minRole: "admin",
  input: updateInput,
  fromForm: (form) => ({ id: form.get("id"), expectedVersion: Number(form.get("expectedVersion")), ...serviceFromForm(form) }),
  echo,
  idempotent: false,
  handler: async (ctx, { id, version, fields }) => {
    try {
      const updated = await updateService(ctx.tx, id, fields, version, ctx.userId);
      return { id: updated.id, version: updated.version };
    } catch (error) {
      refuse(error);
    }
  },
});

export const setServiceArchivedAction = action({
  name: "catalog.service.archive",
  minRole: "admin",
  input: archiveInput,
  fromForm: (form) => ({
    id: form.get("id"),
    expectedVersion: Number(form.get("expectedVersion")),
    archived: form.get("archived") === "true",
  }),
  idempotent: false,
  handler: async (ctx, { id, expectedVersion: version, archived }) => {
    try {
      const updated = await setServiceArchived(ctx.tx, id, archived, version, ctx.userId);
      return { id: updated.id, version: updated.version, archived: updated.archivedAt !== null };
    } catch (error) {
      refuse(error);
    }
  },
});
