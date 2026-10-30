// The JSON-safe event boundary (MON-03). JSON has no bigint and money is bigint minor units, so an amount crosses
// the boundary as its canonical base-10 string: producers write minorUnits(total), consumers parseMinorUnits().
export type MinorUnits = string & { readonly __brand: "MinorUnits" };

export const MINOR_UNITS_PATTERN = /^(0|[1-9][0-9]*)$/;

export function minorUnits(amount: bigint): MinorUnits {
  if (amount < 0n) throw new RangeError("an amount is never negative (spec Money rules)");
  return amount.toString() as MinorUnits;
}

export function parseMinorUnits(value: string): bigint {
  if (!MINOR_UNITS_PATTERN.test(value)) throw new RangeError("not a canonical amount in minor units");
  return BigInt(value);
}

// A uuid, an amount, or a safe integer such as a count. A number is never money.
export type EventPayloadValue = string | MinorUnits | number;
export type EventPayload = Readonly<Record<string, EventPayloadValue>>;
