
import { useEffect, useReducer, useRef } from "react";

import {
  createInventory,
  getAvailableStock,
  getSoldCount,
  inventoryReducer,
} from "../inventory/inventory-machine";

import type {
  InventoryState,
} from "../inventory/inventory-machine";

import "./FlashSaleInventory.css";

const INITIAL_STOCK = 5;
const RESERVATION_TTL_MS = 30_000;

interface FlashSaleInventoryProps {
  isSaleLive: boolean;
}

interface CustomerRequest {
  reservationId: string;
  customer: string;
}

interface BatchResult {
  requested: number;
  accepted: number;
  rejected: number;
  conflicts: number;
}

interface StoreState {
  inventory: InventoryState;
  message: string;
  lastBatch: BatchResult | null;
  history: string[];
}

type StoreAction =
  | {
      type: "RESERVE_REQUESTS";
      requests: CustomerRequest[];
      expectedVersion: number;
      now: number;
    }
  | {
      type: "EXPIRE_LOCKS";
      now: number;
    }
  | {
      type: "RESET";
    };

function createInitialState(): StoreState {
  return {
    inventory: createInventory(INITIAL_STOCK),
    message: "Inventory ready. Waiting for flash sale.",
    lastBatch: null,
    history: [],
  };
}

// Pure reducer: all stock updates are serialized
function storeReducer(
  state: StoreState,
  action: StoreAction
): StoreState {
  if (action.type === "RESET") {
    return {
      ...createInitialState(),
      message: "Inventory simulation reset.",
    };
  }

  if (action.type === "EXPIRE_LOCKS") {
    const updated = inventoryReducer(
      state.inventory,
      {
        type: "EXPIRE_LOCKS",
        now: action.now,
      }
    );

    if (updated === state.inventory) {
      return state;
    }

    const oldAvailable = getAvailableStock(
      state.inventory
    );

    const newAvailable = getAvailableStock(updated);

    const released = newAvailable - oldAvailable;

    const message =
      `${released} expired reservation(s) released.`;

    return {
      ...state,
      inventory: updated,
      message,
      history: [message, ...state.history].slice(0, 8),
    };
  }

  let current = inventoryReducer(
    state.inventory,
    {
      type: "EXPIRE_LOCKS",
      now: action.now,
    }
  );

  let accepted = 0;
  let rejected = 0;
  let conflicts = 0;

  for (const request of action.requests) {
    // Detect requests based on a stale inventory snapshot
    if (current.version !== action.expectedVersion) {
      conflicts++;

      // Simulated optimistic retry:
      // use the latest reducer state before reserving.
    }

    try {
      current = inventoryReducer(current, {
        type: "RESERVE",
        reservationId: request.reservationId,
        now: action.now,
        ttlMs: RESERVATION_TTL_MS,
      });

      accepted++;
    } catch {
      // Rejected when stock is exhausted or request is invalid
      rejected++;
    }
  }

  const message =
    `Reservation requests: ${action.requests.length}. ` +
    `Accepted: ${accepted}. ` +
    `Rejected: ${rejected}. ` +
    `Stale-version retries: ${conflicts}.`;

  return {
    inventory: current,
    message,
    lastBatch: {
      requested: action.requests.length,
      accepted,
      rejected,
      conflicts,
    },
    history: [message, ...state.history].slice(0, 8),
  };
}

export default function FlashSaleInventory({
  isSaleLive,
}: FlashSaleInventoryProps) {
  const [state, dispatch] = useReducer(
    storeReducer,
    undefined,
    createInitialState
  );

  const requestCounter = useRef(0);

  // Automatically expire old inventory locks
  useEffect(() => {
    if (!isSaleLive) return;

    const intervalId = window.setInterval(() => {
      dispatch({
        type: "EXPIRE_LOCKS",
        now: Date.now(),
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSaleLive]);

  const available = getAvailableStock(state.inventory);
  const sold = getSoldCount(state.inventory);

  const activeReservations = Object.values(
    state.inventory.reservations
  ).filter(
    (reservation) =>
      reservation.status === "RESERVED" ||
      reservation.status === "CHECKOUT"
  );

  const reserved = activeReservations.length;

  // Generate unique identifiers outside the reducer
  const createRequests = (
    count: number
  ): CustomerRequest[] => {
    return Array.from({ length: count }, () => {
      const number = ++requestCounter.current;

      return {
        reservationId: `reservation-${Date.now()}-${number}`,
        customer: `Customer ${number}`,
      };
    });
  };

  // Submit one or multiple simulated customers
  const reserveProducts = (count: number) => {
    if (!isSaleLive) return;

    dispatch({
      type: "RESERVE_REQUESTS",
      requests: createRequests(count),
      expectedVersion: state.inventory.version,
      now: Date.now(),
    });
  };

  const resetInventory = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <div className="inventory-widget">
      <div className="inventory-heading">
        <h3>Optimistic Inventory Lock</h3>

        <span className="inventory-version">
          Version: {state.inventory.version}
        </span>
      </div>

      <p>
        Flash sale inventory simulation with
        optimistic version checks and
        time-limited reservations.
      </p>

      {/* Inventory statistics */}
      <div className="inventory-stats">
        <div className="inventory-stat">
          <span>Total Stock</span>
          <strong>{state.inventory.totalStock}</strong>
        </div>

        <div className="inventory-stat">
          <span>Available</span>
          <strong>{available}</strong>
        </div>

        <div className="inventory-stat">
          <span>Reserved</span>
          <strong>{reserved}</strong>
        </div>

        <div className="inventory-stat">
          <span>Sold</span>
          <strong>{sold}</strong>
        </div>
      </div>

      {/* Sale availability */}
      <p className="inventory-availability">
        {isSaleLive
          ? available > 0
            ? `${available} products available for reservation.`
            : "Sold out or fully reserved."
          : "Reservations open when the flash sale starts."}
      </p>

      {/* Reservation controls */}
      <div
        className="inventory-controls"
        role="group"
        aria-label="Inventory reservation controls"
      >
        <button
          type="button"
          onClick={() => reserveProducts(1)}
          disabled={!isSaleLive || available === 0}
        >
          Reserve Product
        </button>

        <button
          type="button"
          onClick={() => reserveProducts(20)}
          disabled={!isSaleLive || available === 0}
        >
          Simulate 20 Customers
        </button>

        <button
          type="button"
          className="inventory-reset-button"
          onClick={resetInventory}
          disabled={!isSaleLive}
        >
          Reset Inventory
        </button>
      </div>

      {/* Live screen reader announcement */}
      <p
        className="inventory-feedback"
        role="status"
        aria-atomic="true"
      >
        {state.message}
      </p>

      {/* Simulation results */}
      {state.lastBatch && (
        <div className="simulation-results">
          <h4>Latest Simulation Results</h4>

          <dl>
            <div>
              <dt>Requests</dt>
              <dd>{state.lastBatch.requested}</dd>
            </div>

            <div>
              <dt>Accepted</dt>
              <dd>{state.lastBatch.accepted}</dd>
            </div>

            <div>
              <dt>Rejected</dt>
              <dd>{state.lastBatch.rejected}</dd>
            </div>

            <div>
              <dt>Version conflicts</dt>
              <dd>{state.lastBatch.conflicts}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Active reservations */}
      <section
        className="reservation-list"
        aria-labelledby="reservation-heading"
      >
        <h4 id="reservation-heading">
          Active Reservations ({reserved})
        </h4>

        {activeReservations.length === 0 ? (
          <p>No active reservations.</p>
        ) : (
          <ul>
            {activeReservations.map((reservation) => (
              <li key={reservation.id}>
                <strong>{reservation.id}</strong>

                <span>
                  Status: {reservation.status}
                </span>

                <span>
                  Expires:{" "}
                  {new Date(
                    reservation.expiresAt
                  ).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Simulation log */}
      <section
        className="inventory-history"
        aria-labelledby="inventory-history-heading"
      >
        <h4 id="inventory-history-heading">
          Simulation History
        </h4>

        {state.history.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ol>
            {state.history.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ol>
        )}
      </section>

      <p className="inventory-note">
        This is a client-side concurrency simulation.
        Real multi-user transactions require
        server-side atomic inventory updates.
      </p>
    </div>
  );
}
