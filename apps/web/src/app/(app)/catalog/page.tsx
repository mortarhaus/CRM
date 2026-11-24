import { formatMinor, minorToDecimal, PICKER_CURRENCIES } from "@crm/core/money";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SelectOption } from "@/components/settings/settings-field";
import { findService, listServices, type Service } from "@/db/catalog/services";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import {
  CATALOG_ARCHIVED_EMPTY,
  CATALOG_ARCHIVED_HEADING,
  CATALOG_BACK,
  CATALOG_COLUMN_ACTIONS,
  CATALOG_COLUMN_NAME,
  CATALOG_COLUMN_PRICE,
  CATALOG_COLUMN_TAXABLE,
  CATALOG_COLUMN_UNIT,
  CATALOG_EDIT,
  CATALOG_EDIT_HEADING,
  CATALOG_EMPTY,
  CATALOG_FORBIDDEN,
  CATALOG_INTRO,
  CATALOG_LIST_HEADING,
  CATALOG_NEW_HEADING,
  CATALOG_NO,
  CATALOG_NO_PRICE,
  CATALOG_SHOW_ACTIVE,
  CATALOG_SHOW_ARCHIVED,
  CATALOG_TITLE,
  CATALOG_YES,
  SETUP_PENDING,
} from "@/lib/auth/messages";
import { createServiceAction, setServiceArchivedAction, updateServiceAction } from "./actions";
import { ArchiveForm, ServiceForm, type ServiceValues } from "./service-form";

export const metadata: Metadata = { title: "Catalog · CRM" };

type Loaded =
  | { kind: "forbidden" }
  | { kind: "pending" }
  | { kind: "ready"; services: Service[]; editing: Service | null; defaultCurrency: string; taxRegistered: boolean; locale: string };

// The query is a view choice only (which list, which service to edit); the role and workspace come from the session.
const query = z.object({
  show: z.literal("archived").optional().catch(undefined),
  edit: z.uuid().optional().catch(undefined),
});

// Admin and Owner (spec line 792). Staff see the refusal instead of the catalog; each action checks the role again
// (AUTH-02). A new service's currency is the workspace default currency (spec v4.6 revision 1).
async function load(archived: boolean, editId: string | undefined): Promise<Loaded> {
  try {
    const { workspaceId } = await requireWorkspaceMember("admin");
    return await withWorkspace(workspaceId, async (tx): Promise<Loaded> => {
      const settings = await getSettings(tx);
      if (settings.defaultCurrency === null) return { kind: "pending" };
      const [services, editing] = await Promise.all([
        listServices(tx, { archived }),
        editId === undefined ? null : findService(tx, editId),
      ]);
      return {
        kind: "ready",
        services,
        editing,
        defaultCurrency: settings.defaultCurrency,
        taxRegistered: settings.taxRegistered,
        locale: settings.locale ?? "en",
      };
    });
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    // An Admin or Owner without 2FA in a workspace that requires it (require_2fa) enrols first.
    if (error.status === "TWO_FACTOR_REQUIRED") redirect("/settings/security");
    return { kind: "forbidden" };
  }
}

// MYR and SGD first, then A to Z (plan Q22), each with its name in the workspace locale. Built here, on the server,
// so the browser shows exactly these labels (no second Intl lookup to differ from).
function currencyOptions(locale: string): SelectOption[] {
  const names = new Intl.DisplayNames([locale], { type: "currency", fallback: "code" });
  return PICKER_CURRENCIES.map((code) => ({ value: code, label: `${code} – ${names.of(code) ?? code}` }));
}

const formValues = (row: Service): ServiceValues => ({
  id: row.id,
  version: row.version,
  name: row.name,
  description: row.defaultDescription ?? "",
  price: row.defaultUnitPriceMinor === null ? "" : minorToDecimal(row.defaultUnitPriceMinor, row.currency),
  currency: row.currency,
  unit: row.unit ?? "",
  taxable: row.defaultTaxable,
  priceSet: row.defaultUnitPriceMinor !== null,
  archived: row.archivedAt !== null,
});

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { show, edit } = query.parse(await searchParams);
  const archived = show === "archived";
  const loaded = await load(archived, edit);
  const listHref = archived ? "/catalog?show=archived" : "/catalog";

  return (
    <>
      <h1 className="text-2xl font-semibold">{CATALOG_TITLE}</h1>
      {loaded.kind === "forbidden" ? (
        <p className="text-sm">{CATALOG_FORBIDDEN}</p>
      ) : loaded.kind === "pending" ? (
        <p className="text-sm">{SETUP_PENDING}</p>
      ) : (
        <div className="flex flex-col gap-10">
          <p className="text-sm text-muted-foreground">{CATALOG_INTRO}</p>
          {loaded.editing ? (
            <section aria-labelledby="edit-heading" className="flex max-w-2xl flex-col gap-6">
              <h2 id="edit-heading" className="text-lg font-semibold">
                {CATALOG_EDIT_HEADING}
              </h2>
              <ServiceForm
                mode="edit"
                action={updateServiceAction}
                values={formValues(loaded.editing)}
                currencies={currencyOptions(loaded.locale)}
              />
              <ArchiveForm action={setServiceArchivedAction} values={formValues(loaded.editing)} />
              <Link href={listHref} className="self-start text-sm underline underline-offset-4">
                {CATALOG_BACK}
              </Link>
            </section>
          ) : (
            <section aria-labelledby="new-heading" className="flex max-w-2xl flex-col gap-6">
              <h2 id="new-heading" className="text-lg font-semibold">
                {CATALOG_NEW_HEADING}
              </h2>
              <ServiceForm
                mode="create"
                action={createServiceAction}
                values={{ name: "", description: "", price: "", currency: loaded.defaultCurrency, unit: "", taxable: loaded.taxRegistered }}
                currencies={currencyOptions(loaded.locale)}
              />
            </section>
          )}
          <section aria-labelledby="list-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="list-heading" className="text-lg font-semibold">
                {archived ? CATALOG_ARCHIVED_HEADING : CATALOG_LIST_HEADING}
              </h2>
              <Link href={archived ? "/catalog" : "/catalog?show=archived"} className="text-sm underline underline-offset-4">
                {archived ? CATALOG_SHOW_ACTIVE : CATALOG_SHOW_ARCHIVED}
              </Link>
            </div>
            {loaded.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">{archived ? CATALOG_ARCHIVED_EMPTY : CATALOG_EMPTY}</p>
            ) : (
              // Wide content scrolls inside its own box, never the page (FE-14). relative: the sr-only spans
              // (position absolute) are then clipped by this box too, not placed past the page's edge.
              <div className="relative overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">{CATALOG_COLUMN_NAME}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{CATALOG_COLUMN_PRICE}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{CATALOG_COLUMN_UNIT}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{CATALOG_COLUMN_TAXABLE}</th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        <span className="sr-only">{CATALOG_COLUMN_ACTIONS}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loaded.services.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 font-medium break-words">{row.name}</th>
                        <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                          {row.defaultUnitPriceMinor === null ? CATALOG_NO_PRICE : formatMinor(row.defaultUnitPriceMinor, row.currency, loaded.locale)}
                        </td>
                        <td className="px-3 py-2">{row.unit ?? ""}</td>
                        <td className="px-3 py-2">{row.defaultTaxable ? CATALOG_YES : CATALOG_NO}</td>
                        <td className="px-3 py-2">
                          <Link href={`${listHref}${archived ? "&" : "?"}edit=${row.id}`} className="underline underline-offset-4">
                            {CATALOG_EDIT}
                            <span className="sr-only"> {row.name}</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
