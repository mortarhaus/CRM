import {
  ADDRESS_LINE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PAYMENT_QR_MAX_BYTES,
  SETTINGS_TEXT_MAX_LENGTH,
  STEP_UP_VERIFY_USER_FAILURE_LIMIT,
  STEP_UP_WINDOW_SECONDS,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@crm/core/security";
import type { Country } from "@crm/core/settings";
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
export const GENERAL_SHORT_CODE_HINT = "2 to 6 letters or digits, used in document numbers.";
export const GENERAL_SHORT_CODE_INVALID = "Use 2 to 6 letters or digits.";
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
