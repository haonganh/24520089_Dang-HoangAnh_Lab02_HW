
/**
 * Flash Sale Inventory Finite State Machine
 *
 * Prevents overselling through controlled
 * inventory and reservation transitions.
 */

export type ReservationStatus =
  | "RESERVED"
  | "CHECKOUT"
  | "SOLD"
  | "CANCELLED"
  | "EXPIRED";

export interface Reservation {
  id: string;
  status: ReservationStatus;
  createdAt: number;
  expiresAt: number;
}

export interface InventoryState {
  totalStock: number;
  reservations: Record<string, Reservation>;
  version: number;
}

export type InventoryAction =
  | {
      type: "RESERVE";
      reservationId: string;
      now: number;
      ttlMs: number;
    }
  | {
      type: "BEGIN_CHECKOUT";
      reservationId: string;
      now: number;
    }
  | {
      type: "CONFIRM_PURCHASE";
      reservationId: string;
      now: number;
    }
  | {
      type: "CANCEL";
      reservationId: string;
      now: number;
    }
  | {
      type: "EXPIRE_LOCKS";
      now: number;
    };

// Create initial inventory
export function createInventory(
  totalStock: number
): InventoryState {
  if (
    !Number.isSafeInteger(totalStock) ||
    totalStock < 0
  ) {
    throw new Error(
      "Total stock must be a non-negative integer."
    );
  }

  return {
    totalStock,
    reservations: {},
    version: 0,
  };
}

// Calculate remaining available stock
export function getAvailableStock(
  state: InventoryState
): number {
  const occupied = Object.values(
    state.reservations
  ).filter(
    (reservation) =>
      reservation.status === "RESERVED" ||
      reservation.status === "CHECKOUT" ||
      reservation.status === "SOLD"
  ).length;

  return state.totalStock - occupied;
}

// Count successfully sold products
export function getSoldCount(
  state: InventoryState
): number {
  return Object.values(
    state.reservations
  ).filter(
    (reservation) =>
      reservation.status === "SOLD"
  ).length;
}

// Check expiration of active reservations
function expireReservations(
  state: InventoryState,
  now: number
): InventoryState {
  let changed = false;

  const reservations = {
    ...state.reservations,
  };

  for (const [id, reservation] of Object.entries(
    reservations
  )) {
    const isActive =
      reservation.status === "RESERVED" ||
      reservation.status === "CHECKOUT";

    if (
      isActive &&
      now >= reservation.expiresAt
    ) {
      reservations[id] = {
        ...reservation,
        status: "EXPIRED",
      };

      changed = true;
    }
  }

  if (!changed) return state;

  return {
    ...state,
    reservations,
    version: state.version + 1,
  };
}

// Main finite state machine
export function inventoryReducer(
  state: InventoryState,
  action: InventoryAction
): InventoryState {
  if (!Number.isFinite(action.now)) {
    throw new Error("Invalid action timestamp.");
  }

  // Expire old reservations before processing
  const current = expireReservations(
    state,
    action.now
  );

  if (action.type === "EXPIRE_LOCKS") {
    return current;
  }

  const id = action.reservationId.trim();

  if (!id) {
    throw new Error(
      "Reservation ID cannot be empty."
    );
  }

  // RESERVE
  if (action.type === "RESERVE") {
    if (
      !Number.isFinite(action.ttlMs) ||
      action.ttlMs <= 0 ||
      !Number.isFinite(action.now + action.ttlMs)
    ) {
      throw new Error(
        "Reservation TTL must be positive and finite."
      );
    }

    if (current.reservations[id]) {
      throw new Error(
        "Reservation ID already exists."
      );
    }

    if (getAvailableStock(current) <= 0) {
      throw new Error("OUT_OF_STOCK");
    }

    const reservation: Reservation = {
      id,
      status: "RESERVED",
      createdAt: action.now,
      expiresAt: action.now + action.ttlMs,
    };

    return {
      ...current,
      reservations: {
        ...current.reservations,
        [id]: reservation,
      },
      version: current.version + 1,
    };
  }

  const reservation = current.reservations[id];

  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  let nextStatus: ReservationStatus;

  switch (action.type) {
    case "BEGIN_CHECKOUT":
      if (reservation.status !== "RESERVED") {
        throw new Error(
          "Invalid transition to CHECKOUT."
        );
      }

      nextStatus = "CHECKOUT";
      break;

    case "CONFIRM_PURCHASE":
      if (reservation.status !== "CHECKOUT") {
        throw new Error(
          "Invalid transition to SOLD."
        );
      }

      nextStatus = "SOLD";
      break;

    case "CANCEL":
      if (
        reservation.status !== "RESERVED" &&
        reservation.status !== "CHECKOUT"
      ) {
        throw new Error(
          "Only active reservations can be cancelled."
        );
      }

      nextStatus = "CANCELLED";
      break;
  }

  return {
    ...current,
    reservations: {
      ...current.reservations,
      [id]: {
        ...reservation,
        status: nextStatus,
      },
    },
    version: current.version + 1,
  };
}
