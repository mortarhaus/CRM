import { TOTP, URI } from "otpauth";

export function totpFromUri(uri: string): TOTP {
  const otp = URI.parse(uri);
  if (!(otp instanceof TOTP)) throw new Error("expected an otpauth://totp/ URI");
  return otp;
}

export function wrongTotpCode(totp: TOTP): string {
  const now = Date.now();
  const accepted = new Set([-1, 0, 1].map((step) => totp.generate({ timestamp: now + step * totp.period * 1000 })));
  for (let candidate = 0; ; candidate += 1) {
    const code = String(candidate).padStart(totp.digits, "0");
    if (!accepted.has(code)) return code;
  }
}
