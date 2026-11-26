"use server";

import { isCurrency, MoneyParseError, type MoneyParseReason, parseDecimalToMinor } from "@crm/core/money";
import { SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_NAME_MAX_LENGTH, SERVICE_UNIT_MAX_LENGTH } from "@crm/core/security";
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
import { expectedVersion, multilineText, requiredText, text } from "@/lib/settings-input";

// A description may run over several lines; empty is none.
const description = multilineText(SERVICE_DESCRIPTION_MAX_LENGTH).transform((value) => (value === "" ? null : value));

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

// The typed price in the currency's exponent: none when empty (or when the currency is refused on its own), else the
// minor units or the core parser's reason for refusing it.
function parsePrice(price: string, currency: string): { minor: bigint | null } | { refused: MoneyParseReason } {
  if (price.trim() === "" || !isCurrency(currency)) return { minor: null };
  try {
    return { minor: parseDecimalToMinor(price, currency) };
  } catch (error) {
    if (!(error instanceof MoneyParseError)) throw error;
    return { refused: error.reason };
  }
}

function toFields(value: ServiceInput, context: z.RefinementCtx): ServiceFields {
  const price = parsePrice(value.price, value.currency);
  if ("refused" in price) context.addIssue({ code: "custom", path: ["price"], message: price.refused });
  return {
    name: value.name,
    defaultDescription: value.description,
    defaultUnitPriceMinor: "minor" in price ? price.minor : null,
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

// A refused form gets back none of the typed text (Charlie, 2026-11-26, DECISIONS): a name, description, unit or price
// can hold personal data. Only why the price was refused, as the parser's closed reason, with the currency it was read
// in, which parsePrice has checked is an offered code. With JavaScript the browser keeps what was typed.
function echo(form: FormData): Record<string, string> {
  const price = form.get("price");
  const currency = form.get("currency");
  if (typeof price !== "string" || typeof currency !== "string") return {};
  const parsed = parsePrice(price, currency);
  return "refused" in parsed ? { priceRefused: parsed.refused, priceCurrency: currency } : {};
}

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
