import { describe, expect, it } from "vitest";
import {
  describeAmount,
  formatMoneyInput,
  parseMoneyInput,
  parsePastedMoney,
} from "@/lib/money";

describe("parseMoneyInput", () => {
  it("quita los puntos de miles y deja solo dígitos", () => {
    expect(parseMoneyInput("1.234.567")).toBe("1234567");
  });
  it("toma la coma como decimal y limita a 2 decimales", () => {
    expect(parseMoneyInput("1.500,257")).toBe("1500.25");
    expect(parseMoneyInput("12,")).toBe("12.");
    expect(parseMoneyInput(",5")).toBe("0.5");
  });
  it("ignora letras, signos y ceros a la izquierda", () => {
    expect(parseMoneyInput("$ 0012abc")).toBe("12");
    expect(parseMoneyInput("-50")).toBe("50");
    expect(parseMoneyInput("")).toBe("");
  });
  it("limita a 10 dígitos enteros", () => {
    expect(parseMoneyInput("123456789012")).toBe("1234567890");
  });
});

describe("parsePastedMoney", () => {
  it("trata un punto con 1 o 2 decimales como decimal", () => {
    expect(parsePastedMoney("1500.50")).toBe("1500.50");
  });
  it("trata los puntos de 3 dígitos como miles", () => {
    expect(parsePastedMoney("1.500.000")).toBe("1500000");
    expect(parsePastedMoney("1.500")).toBe("1500");
  });
});

describe("formatMoneyInput", () => {
  it("agrupa de a tres con puntos y usa coma decimal", () => {
    expect(formatMoneyInput("1234567.5")).toBe("1.234.567,5");
    expect(formatMoneyInput("999")).toBe("999");
    expect(formatMoneyInput("12.")).toBe("12,");
    expect(formatMoneyInput("")).toBe("");
  });
  it("es inverso de parseMoneyInput", () => {
    for (const raw of ["0", "45000", "1234567.25", "9999999999.99"]) {
      expect(parseMoneyInput(formatMoneyInput(raw))).toBe(raw);
    }
  });
});

describe("describeAmount", () => {
  it("no dice nada con montos normales o vacíos", () => {
    expect(describeAmount("").level).toBe("none");
    expect(describeAmount("0").level).toBe("none");
    expect(describeAmount("45000").level).toBe("none");
  });
  it("avisa si faltan ceros", () => {
    expect(describeAmount("50").level).toBe("info");
  });
  it("resume los millones", () => {
    expect(describeAmount("1500000")).toEqual({
      level: "info",
      message: "≈ 1,5 millones de pesos",
    });
    expect(describeAmount("1000000").message).toContain("1 millón");
    expect(describeAmount("1040000").message).toContain("1 millón");
  });
  it("advierte de montos muy grandes y marca error sobre el máximo", () => {
    expect(describeAmount("250000000").level).toBe("warning");
    expect(describeAmount("5000000000").message).toContain("mil millones");
    expect(describeAmount("10000000000").level).toBe("error");
  });
});
