
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createInventory,
  getAvailableStock,
  getSoldCount,
  inventoryReducer,
} from "./inventory-machine";

import type {
  InventoryState,
} from "./inventory-machine";

const NOW = 1_000_000;
const TTL = 30_000;

// Helper: reserve one product
function reserve(
  state: InventoryState,
  id: string,
  now = NOW
): InventoryState {
  return inventoryReducer(state, {
    type: "RESERVE",
    reservationId: id,
    now,
    ttlMs: TTL,
  });
}

describe("Inventory State Machine", () => {
  it("prevents overselling with 20 customer requests", () => {
    let state = createInventory(5);

    let accepted = 0;
    let rejected = 0;

    for (let i = 1; i <= 20; i++) {
      try {
        state = reserve(state, `customer-${i}`);
        accepted++;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        rejected++;
      }
    }

    expect(accepted).toBe(5);
    expect(rejected).toBe(15);

    expect(getAvailableStock(state)).toBe(0);
    expect(getSoldCount(state)).toBe(0);

    expect(state.version).toBe(5);
  });

  it("prevents duplicate reservations", () => {
    let state = createInventory(5);

    state = reserve(state, "customer-1");

    expect(() =>
      reserve(state, "customer-1")
    ).toThrow("Reservation ID already exists.");

    expect(getAvailableStock(state)).toBe(4);
  });

  it("supports reservation to checkout to sold", () => {
    let state = createInventory(5);

    state = reserve(state, "order-1");

    expect(
      state.reservations["order-1"].status
    ).toBe("RESERVED");

    state = inventoryReducer(state, {
      type: "BEGIN_CHECKOUT",
      reservationId: "order-1",
      now: NOW + 1000,
    });

    expect(
      state.reservations["order-1"].status
    ).toBe("CHECKOUT");

    state = inventoryReducer(state, {
      type: "CONFIRM_PURCHASE",
      reservationId: "order-1",
      now: NOW + 2000,
    });

    expect(
      state.reservations["order-1"].status
    ).toBe("SOLD");

    expect(getSoldCount(state)).toBe(1);
    expect(getAvailableStock(state)).toBe(4);
  });

  it("restores inventory after cancellation", () => {
    let state = createInventory(2);

    state = reserve(state, "order-1");

    expect(getAvailableStock(state)).toBe(1);

    state = inventoryReducer(state, {
      type: "BEGIN_CHECKOUT",
      reservationId: "order-1",
      now: NOW + 1000,
    });

    // Simulate payment failure through cancellation
    state = inventoryReducer(state, {
      type: "CANCEL",
      reservationId: "order-1",
      now: NOW + 2000,
    });

    expect(
      state.reservations["order-1"].status
    ).toBe("CANCELLED");

    expect(getAvailableStock(state)).toBe(2);
    expect(getSoldCount(state)).toBe(0);
  });

  it("releases expired reservations", () => {
    let state = createInventory(3);

    state = reserve(state, "order-1");
    state = reserve(state, "order-2");

    expect(getAvailableStock(state)).toBe(1);

    // Advance beyond reservation TTL
    state = inventoryReducer(state, {
      type: "EXPIRE_LOCKS",
      now: NOW + TTL + 1000,
    });

    expect(getAvailableStock(state)).toBe(3);

    expect(
      state.reservations["order-1"].status
    ).toBe("EXPIRED");

    expect(
      state.reservations["order-2"].status
    ).toBe("EXPIRED");
  });

  it("rejects invalid state transitions", () => {
    let state = createInventory(2);

    state = reserve(state, "order-1");

    // Cannot confirm without checkout
    expect(() =>
      inventoryReducer(state, {
        type: "CONFIRM_PURCHASE",
        reservationId: "order-1",
        now: NOW + 1000,
      })
    ).toThrow("Invalid transition");

    state = inventoryReducer(state, {
      type: "BEGIN_CHECKOUT",
      reservationId: "order-1",
      now: NOW + 1000,
    });

    state = inventoryReducer(state, {
      type: "CONFIRM_PURCHASE",
      reservationId: "order-1",
      now: NOW + 2000,
    });

    // Cannot cancel a sold product
    expect(() =>
      inventoryReducer(state, {
        type: "CANCEL",
        reservationId: "order-1",
        now: NOW + 3000,
      })
    ).toThrow("Only active reservations");
  });

  it("rejects invalid stock values", () => {
    expect(() => createInventory(-1)).toThrow();

    expect(() =>
      createInventory(2.5)
    ).toThrow();

    expect(() =>
      createInventory(Number.NaN)
    ).toThrow();
  });
});
