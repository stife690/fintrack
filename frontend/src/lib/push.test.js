import { describe, expect, it, vi } from "vitest";
import { pushErrorMessage, subscribePush } from "@/lib/push";

/** Error con el `name` de un DOMException del navegador. */
function domError(name, message = "") {
  return Object.assign(new Error(message), { name });
}

/** Registro falso: `subscribe` falla con los errores dados, en orden, y luego responde. */
function fakeRegistration(...failures) {
  const old = { unsubscribe: vi.fn().mockResolvedValue(true) };
  const subscribe = vi.fn();
  failures.forEach((err) => subscribe.mockRejectedValueOnce(err));
  subscribe.mockResolvedValue({ endpoint: "https://push.example/1" });
  return { old, pushManager: { subscribe, getSubscription: vi.fn().mockResolvedValue(old) } };
}

const KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

describe("subscribePush", () => {
  it("reintenta una vez si el servicio push falla", async () => {
    vi.useFakeTimers();
    const registration = fakeRegistration(domError("AbortError", "Registration failed - push service error"));
    const result = subscribePush(registration, KEY);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ endpoint: "https://push.example/1" });
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("reemplaza una suscripción hecha con otra llave", async () => {
    const registration = fakeRegistration(domError("InvalidStateError"));
    await subscribePush(registration, KEY);
    expect(registration.old.unsubscribe).toHaveBeenCalled();
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2);
  });

  it("no reintenta otros errores", async () => {
    const registration = fakeRegistration(domError("NotAllowedError"));
    await expect(subscribePush(registration, KEY)).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });
});

describe("pushErrorMessage", () => {
  it("explica en español el fallo del servicio push", () => {
    const text = pushErrorMessage(domError("AbortError", "Registration failed - push service error"));
    expect(text).toMatch(/servicio de notificaciones/);
    expect(text).not.toMatch(/Registration failed/);
  });

  it("deja pasar los mensajes propios de la app", () => {
    expect(pushErrorMessage(new Error("Sin conexión con el servidor"))).toBe("Sin conexión con el servidor");
  });
});
