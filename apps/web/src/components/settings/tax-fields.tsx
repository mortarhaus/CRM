import { Label } from "@/components/ui/label";
import { Radio } from "@/components/ui/radio";
import {
  ONBOARDING_NO,
  ONBOARDING_OWN_BRN,
  ONBOARDING_OWN_IDS_LEGEND,
  ONBOARDING_OWN_TIN,
  ONBOARDING_REGISTRATION_REQUIRED,
  ONBOARDING_TAX_NAME,
  ONBOARDING_TAX_NAME_REQUIRED,
  ONBOARDING_TAX_RATE,
  ONBOARDING_TAX_RATE_HINT,
  ONBOARDING_TAX_RATE_INVALID,
  ONBOARDING_TEXT_INVALID,
  ONBOARDING_YES,
  onboardingRegistrationNo,
  onboardingTaxQuestion,
} from "@/lib/auth/messages";
import { TextField } from "./settings-field";

// The field errors these fields can show, by the action's field path.
export const TAX_FIELD_ERRORS: Record<string, string> = {
  taxRegistrationNo: ONBOARDING_REGISTRATION_REQUIRED,
  taxName: ONBOARDING_TAX_NAME_REQUIRED,
  taxRate: ONBOARDING_TAX_RATE_INVALID,
  ownTin: ONBOARDING_TEXT_INVALID,
  ownBrn: ONBOARDING_TEXT_INVALID,
};

interface TaxFieldsProps {
  // "SST" or "GST", from the workspace's country (spec line 732).
  scheme: string;
  taxHint: string;
  idsHint: string;
  yes: boolean;
  values: { registrationNo?: string; taxName?: string; taxRate?: string; ownTin?: string; ownBrn?: string };
  fieldError: (name: string) => string | undefined;
}

// The SST/GST question with its tax fields, and the own TIN and BRN (onboarding and general settings). The tax fields
// show only for a Yes, by CSS, so the enclosing form must be a `group`; they are posted with a No as well and ignored.
export function TaxFields({ scheme, taxHint, idsHint, yes, values, fieldError }: TaxFieldsProps) {
  return (
    <>
      <fieldset className="flex flex-col gap-3" aria-describedby="tax-registered-hint">
        <legend className="mb-1 text-lg font-semibold">{onboardingTaxQuestion(scheme)}</legend>
        <p id="tax-registered-hint" className="text-sm text-muted-foreground">
          {taxHint}
        </p>
        <div className="flex min-h-10 items-center gap-3">
          <Radio id="tax-registered-no" name="taxRegistered" value="no" defaultChecked={!yes} />
          <Label htmlFor="tax-registered-no">{ONBOARDING_NO}</Label>
        </div>
        <div className="flex min-h-10 items-center gap-3">
          <Radio id="tax-registered-yes" name="taxRegistered" value="yes" defaultChecked={yes} />
          <Label htmlFor="tax-registered-yes">{ONBOARDING_YES}</Label>
        </div>
      </fieldset>

      <div className="hidden flex-col gap-6 group-has-[#tax-registered-yes:checked]:flex">
        <TextField
          id="tax-registration-no"
          name="taxRegistrationNo"
          label={onboardingRegistrationNo(scheme)}
          defaultValue={values.registrationNo}
          error={fieldError("taxRegistrationNo")}
        />
        <TextField id="tax-name" name="taxName" label={ONBOARDING_TAX_NAME} defaultValue={values.taxName} error={fieldError("taxName")} />
        <TextField
          id="tax-rate"
          name="taxRate"
          label={ONBOARDING_TAX_RATE}
          hint={ONBOARDING_TAX_RATE_HINT}
          defaultValue={values.taxRate}
          inputMode="decimal"
          error={fieldError("taxRate")}
        />
      </div>

      <fieldset className="flex flex-col gap-6" aria-describedby="own-ids-hint">
        <legend className="mb-1 text-lg font-semibold">{ONBOARDING_OWN_IDS_LEGEND}</legend>
        <p id="own-ids-hint" className="text-sm text-muted-foreground">
          {idsHint}
        </p>
        <TextField id="own-tin" name="ownTin" label={ONBOARDING_OWN_TIN} defaultValue={values.ownTin} error={fieldError("ownTin")} />
        <TextField id="own-brn" name="ownBrn" label={ONBOARDING_OWN_BRN} defaultValue={values.ownBrn} error={fieldError("ownBrn")} />
      </fieldset>
    </>
  );
}
