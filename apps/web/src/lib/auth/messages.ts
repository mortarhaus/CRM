import {
  ADDRESS_LINE_MAX_LENGTH,
  EMAIL_TEMPLATE_BODY_MAX_LENGTH,
  EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NUMBER_SEQ_MAX_WIDTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PAYMENT_QR_MAX_BYTES,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_UNIT_MAX_LENGTH,
  SETTINGS_TEXT_MAX_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MIN_LENGTH,
  STEP_UP_VERIFY_USER_FAILURE_LIMIT,
  STEP_UP_WINDOW_SECONDS,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@crm/core/security";
import type { MoneyParseReason } from "@crm/core/money";
import type { PatternError, ResetRule } from "@crm/core/numbering";
import type { Country } from "@crm/core/settings";
import type { EmailEvent, TemplateField } from "@crm/core/templates";
import type { LimitErrorCode } from "./input-limits";

export const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a moment and try again.";
export const WRONG_CODE = "That code didn't work. Check your authenticator app and try again.";
export const WRONG_RECOVERY_CODE = "That recovery code didn't work. Check it and try again.";
export const TWO_FACTOR_EXPIRED = "Your sign-in expired or had too many tries. Sign in again to continue.";
export const SIGN_IN_FAILED = "Email or password is incorrect.";
export const SIGN_UP_FAILED = "We couldn't create your account. Check your details and try again.";
export const WORKSPACE_NAME_REQUIRED = "Enter a workspace name.";
export const WORKSPACE_CREATE_FAILED = "We couldn't create that workspace. Try again.";
export const WORKSPACE_SWITCH_FAILED = "Couldn't switch workspace. Try again.";
export const SIGN_OUT_FAILED = "We couldn't sign you out. Try again.";
export const TWO_FACTOR_PASSWORD_WRONG = "Your password didn't match. Try again.";

// /settings/email (Charlie, ASK 8 = A, 2026-11-01; the intro sentence is the builder's).
export const TEST_EMAIL_INTRO = "Send a test email to your own address to check that email delivery works.";
export const SEND_TEST_EMAIL = "Send a test email";
export const SENDING_TEST_EMAIL = "Sending…";
export const TEST_EMAIL_QUEUED = "Test email queued.";
export const TEST_EMAIL_FORBIDDEN = "Only an Admin or Owner can send a test email.";
export const TEST_EMAIL_FAILED = "We couldn't send the test email. Try again.";
export const TEST_EMAIL_RATE_LIMITED = "You sent several test emails already. Try again in an hour.";

// /settings/branding (plan Task 6; builder copy).
export const BRANDING_INTRO =
  "Your brand colour fills buttons and the selected menu item, and outlines the control in focus. Text on it is black or white, whichever reads better.";
export const BRANDING_HINT = "Enter # and six hex digits, for example #0e6c84, or pick a colour below.";
export const SAVE_BRANDING = "Save colour";
export const SAVING_BRANDING = "Saving…";
export const BRANDING_SAVED = "Brand colour saved.";
export const BRANDING_INVALID = "That isn't a colour we can use. Enter # and six hex digits, for example #0e6c84.";
export const BRANDING_STALE = "Someone else changed the branding after this page loaded. Reload the page, then save again.";
export const BRANDING_FORBIDDEN = "Only an Admin or Owner can change the branding.";
export const BRANDING_FAILED = "We couldn't save the colour. Try again.";

// /settings/branding, the logo (plan Task 12; builder copy; the limit is the owner's, 2026-11-11).
export const LOGO_HEADING = "Logo";
export const LOGO_LABEL = "Logo file";
export const LOGO_ALT = "Your workspace logo";
export const LOGO_HINT = "A PNG or JPG file, up to 2 MB.";
export const LOGO_NONE = "No logo uploaded yet.";
export const UPLOAD_LOGO = "Upload logo";
export const UPLOADING_LOGO = "Uploading…";
export const LOGO_SAVED = "Logo uploaded.";
export const LOGO_EMPTY = "Choose a PNG or JPG file to upload.";
export const LOGO_TOO_LARGE = "That file is larger than 2 MB. Choose a smaller PNG or JPG.";
export const LOGO_TYPE_NOT_ALLOWED = "That file isn't a PNG or JPG image. Choose a PNG or JPG file.";
export const LOGO_UNAVAILABLE = "Logo uploads are not set up on this server yet.";
export const LOGO_FAILED = "We couldn't upload the logo. Try again.";

// /onboarding (plan Task 8; the SST/GST question is the spec's, line 732; the rest is builder copy).
export const ONBOARDING_TITLE = "Set up your workspace";
export const COUNTRY_NAMES: Record<Country, string> = { MY: "Malaysia", SG: "Singapore" };
// The question names the country's own tax (spec line 732: "SST (MY) / GST (SG)").
export const TAX_SCHEMES: Record<Country, string> = { MY: "SST", SG: "GST" };
export const ONBOARDING_COUNTRY_LEGEND = "Where is your business registered?";
export const ONBOARDING_CONTINUE = "Continue";
export const ONBOARDING_CHANGE_COUNTRY = "Change country";
export const ONBOARDING_SAVE = "Finish setup";
export const ONBOARDING_SAVING = "Saving…";
export const ONBOARDING_YES = "Yes";
export const onboardingTaxQuestion = (scheme: string) => `Are you registered for ${scheme}?`;
export const onboardingRegistrationNo = (scheme: string) => `${scheme} registration number`;
export const ONBOARDING_OWN_IDS_LEGEND = "Registration numbers";
export const ONBOARDING_NO = "No";
export const ONBOARDING_TAX_HINT = "You can change this later in settings. A change applies to new documents only.";
export const ONBOARDING_TAX_NAME = "Tax name";
export const ONBOARDING_TAX_RATE = "Tax rate (%)";
export const ONBOARDING_TAX_RATE_HINT = "A percentage, for example 8 or 6.5.";
export const ONBOARDING_OPTIONAL_IDS = "Optional. You can add these later in settings.";
export const ONBOARDING_OWN_TIN = "Tax identification number (TIN)";
export const ONBOARDING_OWN_BRN = "Business registration number (BRN)";
export const ONBOARDING_INVALID = "Check the fields marked below, then try again.";
export const ONBOARDING_REGISTRATION_REQUIRED = "Enter your registration number.";
export const ONBOARDING_TAX_NAME_REQUIRED = "Enter the tax name.";
export const ONBOARDING_TAX_RATE_INVALID = "Enter the rate as a percentage, for example 8 or 6.5.";
export const ONBOARDING_TEXT_INVALID = `Use at most ${SETTINGS_TEXT_MAX_LENGTH} characters, without special formatting characters.`;
export const ONBOARDING_STALE = "This workspace was set up after this page loaded. Reload the page.";
export const ONBOARDING_FAILED = "We couldn't save your answers. Try again.";
// Shown to an Admin or Staff member while the Owner has not finished onboarding (plan Task 8).
// Any form whose page was rendered for another workspace than the session's active one (action(), WORKSPACE_CHANGED).
export const WORKSPACE_CHANGED_MESSAGE =
  "This page was opened in another workspace, so nothing was saved. Reload the page to see the active workspace.";
export const SETUP_PENDING = "The owner has not finished setting up this workspace.";
export const SETUP_PENDING_HINT = "You can switch to another workspace or sign out.";

// /settings/general (plan Task 9; builder copy, except "applies to new documents only", spec lines 460 and 731). The
// tax and registration-number fields reuse the onboarding copy above.
export const GENERAL_TITLE = "General settings";
export const GENERAL_INTRO = "Your business details, timezone, currencies and tax.";
export const GENERAL_BUSINESS_LEGEND = "Business details";
export const GENERAL_REGIONAL_LEGEND = "Timezone and currencies";
export const GENERAL_COUNTRY = "Country";
export const GENERAL_SHORT_CODE = "Short code";
export const GENERAL_SHORT_CODE_HINT = `${SHORT_CODE_MIN_LENGTH} to ${SHORT_CODE_MAX_LENGTH} letters or digits, used in document numbers.`;
export const GENERAL_SHORT_CODE_INVALID = `Use ${SHORT_CODE_MIN_LENGTH} to ${SHORT_CODE_MAX_LENGTH} letters or digits.`;
// Onboarding asks for the same code with the same label and error, and says it can be skipped (Charlie 2026-11-24).
export const ONBOARDING_SHORT_CODE_HINT = `Optional. ${GENERAL_SHORT_CODE_HINT} You can skip it and set it later in General settings.`;
export const GENERAL_ADDRESS_LINE1 = "Address line 1";
export const GENERAL_ADDRESS_LINE2 = "Address line 2";
export const GENERAL_ADDRESS_CITY = "City";
export const GENERAL_ADDRESS_POSTCODE = "Postcode";
export const GENERAL_ADDRESS_STATE = "State";
export const GENERAL_ADDRESS_INVALID = `Use at most ${ADDRESS_LINE_MAX_LENGTH} characters, without special formatting characters.`;
export const GENERAL_TIMEZONE = "Timezone";
export const GENERAL_DATE_FORMAT = "Date format";
export const GENERAL_BASE_CURRENCY = "Base currency";
export const GENERAL_DEFAULT_CURRENCY = "Default currency";
export const GENERAL_CHOICE_INVALID = "Choose one from the list.";
export const NOT_SET = "Not set";
export const GENERAL_OPTIONAL = "Optional.";
export const NEW_DOCUMENTS_ONLY = "A change applies to new documents only.";
export const GENERAL_SAVE = "Save settings";
export const GENERAL_SAVING = "Saving…";
export const GENERAL_SAVED = "Settings saved.";
export const GENERAL_SAVED_NEW_DOCUMENTS = "Settings saved. The change to the base currency or tax applies to new documents only.";
export const GENERAL_STALE = "Someone else changed these settings after this page loaded. Reload the page, then save again.";
export const GENERAL_FORBIDDEN = "Only an Admin or Owner can change these settings.";
export const GENERAL_FAILED = "We couldn't save the settings. Try again.";

// /settings/numbering (plan Task 19; builder copy, except "applies to new documents only", spec "Numbering").
export const NUMBERING_TITLE = "Document numbering";
export const NUMBERING_INTRO = "How invoice numbers are built. An invoice gets its number when it is issued, never as a draft.";
export const NUMBERING_PATTERN = "Invoice number pattern";
export const NUMBERING_PATTERN_HINT =
  "Use {CODE} for the short code, {YYYY} or {YY} for the year, {MM} for the month and {SEQ:4} for the counter (4 digits), with any text between.";
export const NUMBERING_RESET = "Start the counter again at 1";
export const NUMBERING_RESET_HINT = "On the first day of each period, in the workspace timezone.";
export const RESET_RULE_LABELS: Readonly<Record<ResetRule, string>> = {
  never: "Never",
  yearly: "Every year",
  monthly: "Every month",
};
export const NUMBERING_PREVIEW = "Next invoice number";
export const NUMBERING_NO_PREVIEW = "No preview";
export const NUMBERING_NO_CODE = "Set a short code in General settings to use {CODE}.";
export const NUMBERING_INVALID = "Check the pattern and the reset rule.";
export const NUMBERING_SAVE = "Save numbering";
export const NUMBERING_SAVING = "Saving…";
export const NUMBERING_SAVED = "Numbering saved. The change applies to new documents only.";
export const NUMBERING_STALE = "Someone else changed the numbering after this page loaded. Reload the page, then save again.";
export const NUMBERING_FORBIDDEN = "Only an Admin or Owner can change document numbering.";
export const NUMBERING_FAILED = "We couldn't save the numbering. Try again.";
// The workspace timezone is still before the period of the last number (for example after a change to a timezone
// further west at a year or month boundary): no number is given and the reset rule cannot change until it begins.
export const numberingPeriodBehind = (period: string) =>
  `The last invoice number is from ${period}, which has not started yet in the workspace timezone. Numbering continues when it starts.`;
export const NUMBERING_PERIOD_BEHIND =
  "The last invoice number is from a period that has not started yet in the workspace timezone. Change the reset rule once it starts.";

// Why a typed pattern is refused (parsePatternFor), in the words the field shows.
export function patternErrorMessage(error: PatternError): string {
  switch (error.code) {
    case "EMPTY":
      return "Enter a pattern.";
    case "TOO_LONG":
      return `Use at most ${error.max} characters.`;
    case "UNKNOWN_TOKEN":
      return `${error.token} is not a token. Use {CODE}, {YYYY}, {YY}, {MM} or {SEQ:n}.`;
    case "UNMATCHED_BRACE":
      return "Each { needs a closing }.";
    case "SEQ_WIDTH":
      return `In {SEQ:n}, n is a number from 1 to ${NUMBER_SEQ_MAX_WIDTH}.`;
    case "INVALID_CHARACTER":
      return "Remove the special formatting characters.";
    case "NO_SEQ":
      return "Add the counter, {SEQ:n}.";
    case "MULTIPLE_SEQ":
      return "Use the counter, {SEQ:n}, only once.";
    case "PERIOD_MISSING":
      return error.resetRule === "yearly"
        ? "A counter that starts again every year needs {YYYY} or {YY}, or numbers would repeat."
        : "A counter that starts again every month needs the year and {MM}, or numbers would repeat.";
  }
}

// Step-up (plan Task 13; builder copy). The minutes follow the limits.
export const STEP_UP_HEADING = "Confirm it's you";
export const STEP_UP_HINT = `Enter the 6-digit code from your authenticator app. Changes on this page are then allowed for ${STEP_UP_WINDOW_SECONDS / 60} minutes.`;
export const STEP_UP_LABEL = "Authentication code";
export const STEP_UP_SUBMIT = "Confirm";
export const STEP_UP_CONFIRMING = "Confirming…";
export const STEP_UP_CONFIRMED = `Confirmed. You can make changes on this page for the next ${STEP_UP_WINDOW_SECONDS / 60} minutes.`;
export const STEP_UP_RATE_LIMITED = `Too many wrong codes. Try again in ${STEP_UP_VERIFY_USER_FAILURE_LIMIT.windowSeconds / 60} minutes.`;
export const STEP_UP_FAILED = "We couldn't check the code. Try again.";
export const STEP_UP_NEEDED = "Confirm with a code from your authenticator app first, then save again.";
export const STEP_UP_EXPIRED = "Your confirmation expired. Enter a new code from your authenticator app, then save again.";
export const STEP_UP_ENROL = "Turn on two-factor authentication before you change these details.";
export const STEP_UP_ENROL_LINK = "Go to Security settings";

// /settings/payment (plan Tasks 14 and 15; Q17 fields, Charlie 2026-11-22; builder copy). The QR's name follows the
// workspace country; a workspace without a country cannot reach this page (onboarding comes first).
export const PAYMENT_TITLE = "Bank details";
export const PAYMENT_INTRO = "The bank account clients pay into. Every Owner is notified when it changes.";
export const PAYMENT_FORBIDDEN = "Only an Owner can see and change the bank details.";
export const BANK_NAME = "Bank name";
export const BANK_ACCOUNT_HOLDER = "Account holder name";
export const BANK_ACCOUNT_NUMBER = "Account number";
export const BANK_SWIFT_CODE = "SWIFT code";
export const BANK_SWIFT_HINT = "Optional. 8 or 11 letters and digits.";
export const BANK_FIELD_INVALID = `Enter this detail, in at most ${SETTINGS_TEXT_MAX_LENGTH} characters.`;
export const BANK_SWIFT_INVALID = "Enter 8 or 11 letters and digits, or leave it empty.";
export const BANK_SAVE = "Save bank details";
export const BANK_SAVING = "Saving…";
export const BANK_SAVED = "Bank details saved. Every Owner has been notified.";
export const BANK_STALE = "Someone else changed these details after this page loaded. Reload the page, then save again.";
export const BANK_FAILED = "We couldn't save the bank details. Try again.";
export const PAYMENT_QR_NAMES: Record<Country, string> = { MY: "DuitNow QR", SG: "PayNow QR" };
export const PAYMENT_QR_GENERIC = "Payment QR";
export const paymentQrLabel = (name: string) => `${name} image`;
export const paymentQrAlt = (name: string) => `Your ${name} code`;
export const PAYMENT_QR_HINT = `Optional. A PNG or JPG image, up to ${PAYMENT_QR_MAX_BYTES / (1024 * 1024)} MB.`;
export const PAYMENT_QR_NONE = "No QR code uploaded yet.";
export const PAYMENT_QR_UPLOAD = "Upload QR code";
export const PAYMENT_QR_UPLOADING = "Uploading…";
export const PAYMENT_QR_SAVED = "QR code uploaded. Every Owner has been notified.";
export const PAYMENT_QR_EMPTY = "Choose a PNG or JPG image to upload.";
export const PAYMENT_QR_TOO_LARGE = `That file is larger than ${PAYMENT_QR_MAX_BYTES / (1024 * 1024)} MB. Choose a smaller PNG or JPG.`;
export const PAYMENT_QR_TYPE_NOT_ALLOWED = "That file isn't a PNG or JPG image. Choose a PNG or JPG file.";
export const PAYMENT_QR_UNAVAILABLE = "QR uploads are not set up on this server yet.";
export const PAYMENT_QR_FAILED = "We couldn't upload the QR code. Try again.";

// /catalog (plan Task 22; builder copy). A price is never rounded: too many decimals is refused with the currency's
// own number of places (core money, MON-01).
export const CATALOG_TITLE = "Catalog";
export const CATALOG_INTRO = "The services you sell, with a default description and price for new quotes and invoices.";
export const CATALOG_FORBIDDEN = "Only an Admin or Owner can see and change the catalog.";
export const CATALOG_NEW_HEADING = "New service";
export const CATALOG_EDIT_HEADING = "Edit service";
export const CATALOG_LIST_HEADING = "Services";
export const CATALOG_ARCHIVED_HEADING = "Archived services";
export const CATALOG_SHOW_ARCHIVED = "Show archived services";
export const CATALOG_SHOW_ACTIVE = "Show active services";
export const CATALOG_BACK = "Back to the catalog";
export const CATALOG_EMPTY = "No services yet. Add your first one above.";
export const CATALOG_ARCHIVED_EMPTY = "No archived services.";
export const CATALOG_COLUMN_NAME = "Name";
export const CATALOG_COLUMN_PRICE = "Default price";
export const CATALOG_COLUMN_UNIT = "Unit";
export const CATALOG_COLUMN_TAXABLE = "Taxable";
export const CATALOG_COLUMN_ACTIONS = "Actions";
export const CATALOG_NO_PRICE = "No default price";
export const CATALOG_EDIT = "Edit";
export const CATALOG_NAME = "Name";
export const CATALOG_DESCRIPTION = "Default description";
export const CATALOG_PRICE = "Default unit price";
export const CATALOG_PRICE_HINT = "Optional. For example 1,234.50. Leave it empty to enter a price on each document.";
export const CATALOG_CURRENCY = "Currency";
export const CATALOG_CURRENCY_LOCKED_HINT = "The currency can't change while a default price is set. Clear the price and save first.";
export const CATALOG_UNIT = "Unit";
export const CATALOG_UNIT_HINT = "Optional. For example hour, day or page.";
export const CATALOG_TAXABLE = "Taxable by default";
export const CATALOG_YES = "Yes";
export const CATALOG_NO = "No";
export const CATALOG_CREATE = "Add service";
export const CATALOG_SAVE = "Save service";
export const CATALOG_SAVING = "Saving…";
export const CATALOG_CREATED = "Service added.";
export const CATALOG_SAVED = "Service saved.";
export const CATALOG_ARCHIVE = "Archive service";
export const CATALOG_RESTORE = "Restore service";
export const CATALOG_ARCHIVE_HINT = "An archived service is hidden from the catalog list. Nothing is deleted.";
export const CATALOG_IS_ARCHIVED = "This service is archived.";
export const CATALOG_ARCHIVED = "Service archived.";
export const CATALOG_RESTORED = "Service restored.";
export const CATALOG_INVALID = "Check the fields marked below, then try again.";
export const CATALOG_NAME_INVALID = `Enter a name of at most ${SERVICE_NAME_MAX_LENGTH} characters, without special formatting characters.`;
export const CATALOG_DESCRIPTION_INVALID = `Use at most ${SERVICE_DESCRIPTION_MAX_LENGTH} characters, without special formatting characters.`;
export const CATALOG_UNIT_INVALID = `Use at most ${SERVICE_UNIT_MAX_LENGTH} characters, without special formatting characters.`;
export const CATALOG_CURRENCY_INVALID = "Choose a currency from the list.";
export const CATALOG_CURRENCY_LOCKED = "The currency can't change while a default price is set. Clear the price and save, then change the currency.";
export const CATALOG_STALE = "Someone else changed this service after this page loaded. Reload the page, then save again.";
export const CATALOG_NOT_FOUND = "That service doesn't exist in this workspace.";
export const CATALOG_FAILED = "We couldn't save the service. Try again.";

export const TEMPLATES_TITLE = "Email templates";
// Q23 Phase 2 scope: saved templates are stored and previewed, and no sender reads them yet (runbook phase-1-security,
// "Owner email on a bank-details or payment QR change"; PR 76 Review R1 P2).
export const TEMPLATES_INTRO =
  "Edit and preview this workspace's copy of each email. Saved changes are not used yet: every email CRM sends, including the payment details email to the owner, still uses the default text.";
export const TEMPLATES_FORBIDDEN = "Only an Admin or Owner can see and change email templates.";
export const TEMPLATES_EVENTS = "Emails";
export const TEMPLATE_EVENT_LABELS: Record<EmailEvent, string> = {
  invoice_sent: "Invoice sent",
  payment_reminder: "Payment reminder",
  payment_receipt: "Payment receipt",
  payment_voided: "Payment reversed",
  quote_sent: "Quote sent",
  proposal_sent: "Proposal sent",
  agreement_sent: "Agreement sent",
  payment_details_changed: "Payment details changed (to the owner)",
};
export const TEMPLATE_SUBJECT = "Subject";
export const TEMPLATE_BODY = "Message";
export const TEMPLATE_FIELDS_HINT = "You can use these fields, written with double braces:";
export const TEMPLATE_IS_DEFAULT = "This email uses the default text.";
export const TEMPLATE_SAVE = "Save template";
export const TEMPLATE_SAVING = "Saving…";
export const TEMPLATE_SAVED = "Template saved.";
export const TEMPLATE_RESTORE = "Restore the default text";
export const TEMPLATE_RESTORE_HINT = "Replaces this template's subject and message with the default text.";
export const TEMPLATE_RESTORED = "Default text restored.";
export const TEMPLATE_INVALID = "Check the fields marked below, then try again.";
export const TEMPLATE_SUBJECT_INVALID = `Enter a subject of one line and at most ${EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH} characters, without special formatting characters.`;
export const TEMPLATE_BODY_INVALID = `Enter a message of at most ${EMAIL_TEMPLATE_BODY_MAX_LENGTH} characters, without special formatting characters.`;
// Without JavaScript the refusal carries no text (a template can hold personal data), so the reason is the field's rule.
export const TEMPLATE_SUBJECT_REFUSED = `This subject was not saved. Use one line of at most ${EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH} characters, and only the fields listed above, each written as {{field_name}}.`;
export const TEMPLATE_BODY_REFUSED = `This message was not saved. Use at most ${EMAIL_TEMPLATE_BODY_MAX_LENGTH} characters, and only the fields listed above, each written as {{field_name}}.`;
export const TEMPLATE_DRAFT_NOT_KEPT = "Your changes were not kept: the subject and message below are the saved text. Make your change again, then save.";
export const TEMPLATE_STALE = "Someone else changed this template after this page loaded. Reload the page, then save again.";
export const TEMPLATE_FAILED = "We couldn't save the template. Try again.";
export const TEMPLATE_PREVIEW = "Preview";
export const TEMPLATE_PREVIEW_HINT = "With sample data. Nothing is sent.";
export const TEMPLATE_NO_PREVIEW = "No preview";
export const TEMPLATE_MALFORMED_PLACEHOLDER =
  "Write each field as {{field_name}}, with two braces on each side. Check for a missing, extra or nested brace.";
export const unknownFieldsMessage = (fields: readonly string[]) =>
  `${fields.map((field) => `{{${field}}}`).join(", ")} ${fields.length === 1 ? "is not a field" : "are not fields"} of this email. Use only the fields listed above.`;
// Sample values for the preview (REC-12: watermarked, never stored or sent). Dates as the MY default, dd-mmm-yyyy.
export const TEMPLATE_SAMPLE_VALUES: Record<TemplateField, string> = {
  client_name: "Aisha Rahman",
  workspace_name: "Your Studio",
  sender_name: "Ben Tan",
  invoice_number: "INV-STU-2026-0042",
  amount_due: "MYR 4,800.00",
  amount_paid: "MYR 4,800.00",
  amount_voided: "MYR 4,800.00",
  total: "MYR 12,500.00",
  due_date: "15-Dec-2026",
  paid_date: "10-Dec-2026",
  voided_date: "11-Dec-2026",
  valid_until: "31-Dec-2026",
  quote_number: "QUO-STU-2026-0007",
  proposal_title: "Brand refresh 2027",
  agreement_title: "Service Agreement",
  invoice_link: "https://example.com/l/sample-invoice",
  receipt_link: "https://example.com/l/sample-receipt",
  quote_link: "https://example.com/l/sample-quote",
  proposal_link: "https://example.com/l/sample-proposal",
  agreement_link: "https://example.com/l/sample-agreement",
  owner_name: "Siti Rahim",
  changed_by: "Ben Tan",
  changed_at: "10-Dec-2026 09:15 (Asia/Kuala_Lumpur)",
  what_changed: "bank details",
};

// Why a typed price was refused (parseDecimalToMinor), for its currency.
export function priceErrorMessage(reason: MoneyParseReason, currency: string, exponent: number, largest: string): string {
  switch (reason) {
    case "too_many_decimals":
      return exponent === 0
        ? `A ${currency} price has no decimal places. We don't round prices, so enter a whole number.`
        : `A ${currency} price has at most ${exponent} decimal ${exponent === 1 ? "place" : "places"}. We don't round prices, so enter it with at most ${exponent}.`;
    case "negative":
      return "Enter a price of 0 or more.";
    case "too_large":
      return `Enter a price of at most ${largest}.`;
    case "empty":
    case "invalid":
      return exponent === 0 ? "Enter the price as a number, for example 1,500." : "Enter the price as a number, for example 1,234.50.";
  }
}

// Shown on every page when the browser lacks a feature the app relies on (Charlie via Bob, PR #53 R2; builder copy).
export const OUTDATED_BROWSER = "Your browser is out of date, so parts of CRM may not work properly. Please update your browser.";

// Keyed by the codes `input-limits.ts` refuses with; the text follows the shared limits.
const LIMIT_MESSAGES: Record<LimitErrorCode, string> = {
  PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`,
  PASSWORD_TOO_LONG: `Use at most ${PASSWORD_MAX_LENGTH} characters for your password.`,
  NAME_TOO_LONG: `Use at most ${NAME_MAX_LENGTH} characters for your name.`,
  WORKSPACE_NAME_TOO_LONG: `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
};

export function limitMessage(code: string | undefined): string | undefined {
  return code !== undefined && code in LIMIT_MESSAGES ? LIMIT_MESSAGES[code as LimitErrorCode] : undefined;
}
