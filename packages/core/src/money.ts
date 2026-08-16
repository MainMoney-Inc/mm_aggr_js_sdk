/** Same-currency decimal string helpers. Never mix currencies. */

import { CurrencyMismatchException } from "./errors.js";

export type Money = {
  amount: string;
  currency: string;
};

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchException(
      `Cannot combine ${left.currency} with ${right.currency}`,
    );
  }
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amount: addDecimalStrings(left.amount, right.amount), currency: left.currency };
}

export function addDecimalStrings(left: string, right: string): string {
  const [leftWhole, leftFrac = ""] = splitDecimal(left);
  const [rightWhole, rightFrac = ""] = splitDecimal(right);
  const scale = Math.max(leftFrac.length, rightFrac.length);
  const leftValue = BigInt(leftWhole + leftFrac.padEnd(scale, "0"));
  const rightValue = BigInt(rightWhole + rightFrac.padEnd(scale, "0"));
  const sum = leftValue + rightValue;
  const sign = sum < 0n ? "-" : "";
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, "0");
  if (scale === 0) {
    return `${sign}${digits}`;
  }
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function splitDecimal(value: string): [string, string] {
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = unsigned.split(".");
  const normalizedWhole = `${negative ? "-" : ""}${whole === "" ? "0" : whole}`;
  return [normalizedWhole, frac.replace(/[^0-9]/g, "")];
}
