
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
import "./CheckoutPanel.css";

const INITIAL_STOCK = 5;
const RESERVATION_TTL_MS = 30_000;

interface FlashSaleInventoryProps {
  isSaleLive: boolean;
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

type TransitionOperation =
  | "BEGIN_CHECKOUT"
  | "CONFIRM_PURCHASE"
  | "CANCEL"
  | "FAIL_PAYMENT";

type StoreAction =
  | {
      type: "RESERVE_REQUESTS";
      reservationIds: string[];
      expectedVersion: number;
      now: number;
    }
  | {
      type: "TRANSITION";
      operation: TransitionOperation;
      reservationId: string;
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

// Add an event to the transaction history
function updateStore(
  state: StoreState,
  inventory: InventoryState,
  message: string
): StoreState {
  return {
    ...state,
    inventory,
    message,
    history: [message, ...state.history].slice(0, 10),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown inventory error.";
}

// All inventory mutations use the pure reducer
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

  // Expire reservations using the supplied timestamp
  const current = inventoryReducer(
    state.inventory,
    {
      type: "EXPIRE_LOCKS",
      now: action.now,
    }
  );

  if (action.type === "EXPIRE_LOCKS") {
    if (current === state.inventory) {
      return state;
    }

    const released =
      getAvailableStock(current) -
      getAvailableStock(state.inventory);

    return updateStore(
      state,
      current,
      `${released} expired reservation(s) released.`
    );
  }

  // Handle multiple reservation requests
  if (action.type === "RESERVE_REQUESTS") {
    let inventory = current;

    let accepted = 0;
    let rejected = 0;
    let conflicts = 0;

    for (const reservationId of action.reservationIds) {
      // Detect a stale inventory version
      if (inventory.version !== action.expectedVersion) {
        conflicts++;
      }

      try {
        // Retry against the latest simulated state
        inventory = inventoryReducer(inventory, {
          type: "RESERVE",
          reservationId,
          now: action.now,
          ttlMs: RESERVATION_TTL_MS,
        });

        accepted++;
      } catch {
        rejected++;
      }
    }

    const message =
      `Requests: ${action.reservationIds.length}. ` +
      `Accepted: ${accepted}. ` +
      `Rejected: ${rejected}. ` +
      `Version conflicts: ${conflicts}.`;

    return {
      ...updateStore(state, inventory, message),
      lastBatch: {
        requested: action.reservationIds.length,
        accepted,
        rejected,
        conflicts,
      },
    };
  }

  // Handle checkout, purchase, cancellation and failure
  const { reservationId, operation } = action;

  const inventoryAction =
    operation === "FAIL_PAYMENT"
      ? "CANCEL"
      : operation;

  try {
    const updated = inventoryReducer(current, {
      type: inventoryAction,
      reservationId,
      now: action.now,
    });

    let message: string;

    switch (operation) {
      case "BEGIN_CHECKOUT":
        message =
          `Checkout started for ${reservationId}.`;
        break;

      case "CONFIRM_PURCHASE":
        message =
          `Purchase successful: ${reservationId}.`;
        break;

      case "CANCEL":
        message =
          `Reservation cancelled: ${reservationId}. ` +
          "Stock released.";
        break;

      case "FAIL_PAYMENT":
        message =
          `Payment failed for ${reservationId}. ` +
          "Reservation rolled back and stock restored.";
        break;
    }

    return updateStore(state, updated, message);
  } catch (error) {
    return updateStore(
      state,
      current,
      `Transaction failed: ${getErrorMessage(error)}`
    );
  }
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

  // Automatically expire reservations
  useEffect(() => {
    if (!isSaleLive) return;

    const intervalId = window.setInterval(() => {
      dispatch({
        type: "EXPIRE_LOCKS",
        now: Date.now(),
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
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

  // Reserve one or multiple products
  const reserveProducts = (count: number) => {
    if (!isSaleLive) return;

    const reservationIds = Array.from(
      { length: count },
      () => {
        const number = ++requestCounter.current;

        return `reservation-${Date.now()}-${number}`;
      }
    );

    dispatch({
      type: "RESERVE_REQUESTS",
      reservationIds,
      expectedVersion: state.inventory.version,
      now: Date.now(),
    });
  };

  // Process a state transition
  const performTransition = (
    reservationId: string,
    operation: TransitionOperation
  ) => {
    if (!isSaleLive) return;

    dispatch({
      type: "TRANSITION",
      operation,
      reservationId,
      now: Date.now(),
    });
  };

  return (
    <div className="inventory-widget">
      {/* Inventory overview */}
      <div className="inventory-heading">
        <h3>Optimistic Inventory Lock</h3>

        <span className="inventory-version">
          Version: {state.inventory.version}
        </span>
      </div>

      <p>
        Inventory management with reservation locks,
        checkout transitions, and failure recovery.
      </p>

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

      <p className="inventory-availability">
        {!isSaleLive
          ? "Reservations open when the flash sale starts."
          : available > 0
            ? `${available} products available.`
            : "Sold out or fully reserved."}
      </p>

      {/* Reservation controls */}
      <div
        className="inventory-controls"
        role="group"
        aria-label="Inventory reservation controls"
      >
        <button
          type="button"
          disabled={!isSaleLive || available === 0}
          onClick={() => reserveProducts(1)}
        >
          Reserve Product
        </button>

        <button
          type="button"
          disabled={!isSaleLive || available === 0}
          onClick={() => reserveProducts(20)}
        >
          Simulate 20 Customers
        </button>

        <button
          type="button"
          className="inventory-reset-button"
          disabled={!isSaleLive}
          onClick={() => dispatch({ type: "RESET" })}
        >
          Reset Inventory
        </button>
      </div>

      <p
        className="inventory-feedback"
        role="status"
        aria-atomic="true"
      >
        {state.message}
      </p>

      {/* Concurrency simulation results */}
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
              <dt>Version Conflicts</dt>
              <dd>{state.lastBatch.conflicts}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Checkout state machine */}
      <section
        className="checkout-panel"
        aria-labelledby="checkout-panel-heading"
      >
        <h3 id="checkout-panel-heading">
          Checkout & Payment Simulation
        </h3>

        <p>
          Begin checkout, confirm a purchase,
          cancel a reservation, or simulate
          payment failure to restore inventory.
        </p>

        {activeReservations.length === 0 ? (
          <p className="checkout-empty">
            No active reservations.
            Reserve a product to begin checkout.
          </p>
        ) : (
          <ul className="checkout-list">
            {activeReservations.map((reservation) => (
              <li
                className="checkout-card"
                key={reservation.id}
              >
                <div className="checkout-card-header">
                  <strong>{reservation.id}</strong>

                  <span className="checkout-badge">
                    {reservation.status}
                  </span>
                </div>

                <p>
                  Lock expires at:{" "}
                  <time
                    dateTime={new Date(
                      reservation.expiresAt
                    ).toISOString()}
                  >
                    {new Date(
                      reservation.expiresAt
                    ).toLocaleTimeString()}
                  </time>
                </p>

                <div className="checkout-actions">
                  {reservation.status === "RESERVED" && (
                    <button
                      type="button"
                      onClick={() =>
                        performTransition(
                          reservation.id,
                          "BEGIN_CHECKOUT"
                        )
                      }
                      aria-label={
                        `Begin checkout for ${reservation.id}`
                      }
                    >
                      Begin Checkout
                    </button>
                  )}

                  {reservation.status === "CHECKOUT" && (
                    <>
                      <button
                        type="button"
                        className="confirm-button"
                        onClick={() =>
                          performTransition(
                            reservation.id,
                            "CONFIRM_PURCHASE"
                          )
                        }
                        aria-label={
                          `Confirm purchase for ${reservation.id}`
                        }
                      >
                        Confirm Purchase
                      </button>

                      <button
                        type="button"
                        className="failure-button"
                        onClick={() =>
                          performTransition(
                            reservation.id,
                            "FAIL_PAYMENT"
                          )
                        }
                        aria-label={
                          `Simulate payment failure for ${reservation.id}`
                        }
                      >
                        Simulate Payment Failure
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() =>
                      performTransition(
                        reservation.id,
                        "CANCEL"
                      )
                    }
                    aria-label={
                      `Cancel reservation ${reservation.id}`
                    }
                  >
                    Cancel Reservation
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="checkout-note">
          Payment is simulated locally.
          No real money is charged.
        </p>
      </section>

      {/* Transaction history */}
      <section
        className="inventory-history"
        aria-labelledby="inventory-history-heading"
      >
        <h4 id="inventory-history-heading">
          Transaction History
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
        This is a client-side simulation.
        Production inventory consistency requires
        server-side atomic transactions.
      </p>
    </div>
  );
}
