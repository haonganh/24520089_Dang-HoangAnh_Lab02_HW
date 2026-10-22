# AI Failure Audit — Homework 3: High-Concurrency Flash-Sale E-Commerce Engine

**Course:** Web Application Development (Practical)  
**Assignment:** Homework 3  
**Audit date:** 2026-10-22  
**Accessibility target:** WCAG 2.2 Level AA  
**Source reviewed:** `haonganh/24520089_Dang-HoangAnh_Lab02_HW`, branch `main`, files under `Homework_3/app/src/`  
**Audit stage:** Static code review completed; runtime reproduction, evidence capture, refactoring, and regression verification **PENDING** until performed locally.

> **Evidence integrity:** The three findings below are based on the actual AI-assisted source files in the repository. The observations labelled *Expected* are reproducible test hypotheses, **not a claim that DevTools screenshots were captured**. Replace all `PENDING` fields with real observations and saved screenshots before submitting. A prepared patch is not equivalent to a verified repair.

## 1. Scope and Summary

The application implements a React/TypeScript browser-side flash-sale simulation with a `Date.now()`/`requestAnimationFrame()` countdown, five units of sample inventory, reservation locks, and a checkout state machine. The initial tests validate the reducer's stock limit and several transitions. This audit examines areas that were not adequately covered by those tests.

| Finding | Severity | Original flaw | Affected source | Status |
|---|---|---|---|---|
| **AI-01** | Medium | A version-conflict counter is incremented, but the inventory reducer does not enforce an expected version | `app/src/components/FlashSaleInventory.tsx`, `app/src/inventory/inventory-machine.ts` | **Code-confirmed; runtime proof PENDING; fix PENDING** |
| **AI-02** | High | Changing the React `key` remounts the inventory component and silently erases simulated sales when the countdown is reset | `app/src/App.tsx` | **Code-confirmed; runtime proof PENDING; fix PENDING** |
| **AI-03** | Medium | A focused checkout button is removed on a state change without explicit focus restoration | `app/src/components/FlashSaleInventory.tsx` | **Code-confirmed; keyboard proof PENDING; fix PENDING** |

### Context and limitations

- The simulation does **not** provide server-side transactions, shared stock between browsers, a real payment API, or globally atomic inventory. Even the repaired version should not claim production multi-user safety.
- The existing five-unit stock limit works **within one reducer instance**. AI-01 is specifically about missing *version precondition enforcement*, not demonstrated negative stock.
- The Lighthouse screenshot supplied for T09 displayed **Performance 95, Accessibility 100, Best Practices 96, SEO 82** at mobile width 375 px. Those are the measured numbers in that screenshot, not a certification of full WCAG 2.2 AA conformance.
- Screenshots should not contain personal email addresses, account IDs, or private browser tabs.

---

## 2. AI-01 — Decorative Optimistic Lock / Missing Compare-and-Swap Guard

**Severity:** Medium — concurrency contract violation and misleading conflict accounting.  
**Affected files:** `app/src/components/FlashSaleInventory.tsx`; `app/src/inventory/inventory-machine.ts`.

### AI Prompt

*Accurate summary, not a verbatim transcript:* Implement an optimistic inventory lock, simulate twenty customers competing for five products, report version conflicts, and prevent overselling.

### AI-Generated Code (before refactor)

The generated component reports a conflict but still submits the reservation normally:

```ts
for (const reservationId of action.reservationIds) {
  if (inventory.version !== action.expectedVersion) {
    conflicts++;
  }

  try {
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
```

The original `RESERVE` action type accepts `reservationId`, `now`, and `ttlMs` but **not** an `expectedVersion`. Accordingly, `inventoryReducer` cannot reject a stale inventory snapshot based on the caller's version.

### Risk

The UI suggests optimistic concurrency control, but its version mismatch is merely diagnostic. Without a version precondition at the authoritative state transition, a future asynchronous/API adaptation could silently accept stale commands. The current single-threaded reducer still limits its local stock to five, so **do not represent this bug as a demonstrated oversell**.

### Detection / DevTools proof — PENDING

1. On the **unfixed** app, start the countdown; once LIVE, select **Simulate 20 Customers**.
2. In Chrome DevTools > Console, run:

   ```js
   [...document.querySelectorAll('.simulation-results dd')]
     .map(element => element.textContent?.trim())
   ```

   **Expected UI:** requests 20, accepted 5, rejected 15, version conflicts 19. This illustrates conflict reporting; it **does not alone prove** the missing guard.
3. Open `FlashSaleInventory.tsx` in DevTools Sources or VS Code and capture the mismatch branch. Confirm there is no `expectedVersion` sent to `inventoryReducer`.
4. Create the focused regression test with `node apply_t10_fixes.mjs --prepare`, then run from `app/`:

   ```sh
   npx vitest run src/inventory/optimistic-lock.test.ts
   ```

   **Expected before refactor:** one test fails because a reservation with a stale `expectedVersion` is accepted instead of throwing `VERSION_CONFLICT`. Vitest transpiles TypeScript tests; `npm run build` may reject the new property until the implementation is repaired.
5. Save the actual failing-test screenshot and source/DevTools screenshot.

**Evidence files:** `evidence/ai-01-before.png` and `evidence/ai-01-after.png` — **PENDING**.

### Engineering Refactor

Add an optional `expectedVersion` to the `RESERVE` action for compatibility with existing tests and enforce the precondition within `inventoryReducer`:

```ts
if (
  action.expectedVersion !== undefined &&
  action.expectedVersion !== current.version
) {
  throw new Error("VERSION_CONFLICT");
}
```

Then pass `expectedVersion` from each request. On an actual `VERSION_CONFLICT` error, **retry once** with the newest local version; reject if the stock is exhausted or the retry fails. Do not merely increment a conflict counter.

**Scope of improvement:** Compare-and-swap semantics inside the in-memory reducer. Production safety still requires an atomic conditional update at the backend/database layer.

### Verification — PENDING

- [ ] Before-fix failure is recorded using `optimistic-lock.test.ts`.
- [ ] After-fix test rejects stale versions and accepts a retry with a current version.
- [ ] `npx vitest run` passes all tests.
- [ ] Twenty requests against five stock units accept no more than five units.
- [ ] Screenshots and actual test output are attached.

---

## 3. AI-02 — React Key Causes Inventory and Sales Data Loss

**Severity:** High — incorrect state persistence and checkout integrity in the simulation.  
**Affected file:** `app/src/App.tsx`.

### AI Prompt

*Accurate summary, not a verbatim transcript:* Integrate a countdown, inventory state machine, and checkout UI; open reservations after the countdown reaches LIVE.

### AI-Generated Code (before refactor)

```tsx
<FlashSaleInventory
  key={saleLive ? "live" : "waiting"}
  isSaleLive={saleLive}
/>
```

React treats the two keys as **different component identities**. Changing from `live` to `waiting` unmounts the old inventory and mounts a new one, causing `useReducer(..., createInitialState)` to restart from five available units with no reservations or completed sales.

### Risk

Clicking the countdown's **Reset** button after successfully confirming a purchase resets **Sold** to zero and restores stock even though the checkout has already completed. If the sale restarts, previously sold units become available again. Resetting a timer should not silently undo commercial state.

### Detection / DevTools proof — PENDING

1. On the **unfixed** app, start countdown and wait for LIVE.
2. Select **Reserve Product** > **Begin Checkout** > **Confirm Purchase**.
3. Verify **Sold = 1**, **Available = 4**. In Chrome DevTools > Console:

   ```js
   [...document.querySelectorAll('.inventory-stat strong')]
     .map(element => element.textContent?.trim())
   ```

   **Expected:** `["5", "4", "0", "1"]` (Total, Available, Reserved, Sold).
4. Select the countdown's **Reset** button (NOT the explicitly named **Reset Inventory** button).
5. Repeat the Console expression. **Expected before fix:** `["5", "5", "0", "0"]`, showing a lost sale caused by remounting.
6. Capture the **before and after** counts in DevTools screenshots.

**Evidence files:** `evidence/ai-02-before.png` and `evidence/ai-02-after.png` — **PENDING**.

### Engineering Refactor

Preserve the component's identity by removing the changing key:

```tsx
<FlashSaleInventory isSaleLive={saleLive} />
```

The inventory reducer now survives countdown changes. `isSaleLive` still gates reservations, while the explicitly labelled **Reset Inventory** button remains a deliberate demo reset (its name should make the data-clearing effect clear to users).

### Verification — PENDING

- [ ] After confirming one sale, **Sold = 1**.
- [ ] Reset Countdown does not erase reservations, completed sales, or transaction history.
- [ ] Countdown can be started again without restoring units already sold.
- [ ] Explicit Reset Inventory remains a deliberate simulation-only action.
- [ ] Screenshots show the unchanged Sold value after countdown reset.

---

## 4. AI-03 — Keyboard Focus Lost After Checkout Button Replacement

**Severity:** Medium — keyboard usability, potential WCAG focus-order problem.  
**Affected file:** `app/src/components/FlashSaleInventory.tsx`.

### AI Prompt

*Accurate summary, not a verbatim transcript:* Build an accessible checkout UI using native buttons and proper state transitions, targeting WCAG 2.2 AA.

### AI-Generated Code (before refactor)

```tsx
{reservation.status === "RESERVED" && (
  <button
    type="button"
    onClick={() =>
      performTransition(reservation.id, "BEGIN_CHECKOUT")
    }
  >
    Begin Checkout
  </button>
)}

{reservation.status === "CHECKOUT" && (
  <button type="button" className="confirm-button">
    Confirm Purchase
  </button>
)}
```

The excerpt omits unrelated attributes for readability. The real code conditionally removes the focused **Begin Checkout** button and mounts a different **Confirm Purchase** button. It has **no focus restoration logic**.

### Risk

After activation with Enter/Space, the focused element may be removed from the DOM. Browser focus can fall back to the page body instead of the next relevant checkout action. A keyboard-only user may need to rediscover the controls. Lighthouse Accessibility 100/100 does not automatically detect all dynamic focus-management issues.

### Detection / DevTools proof — PENDING

1. On the **unfixed** app, reach LIVE and reserve one product.
2. Press **Tab** until **Begin Checkout** receives visible keyboard focus; press **Enter**.
3. In Chrome DevTools > Console, inspect:

   ```js
   ({
     tag: document.activeElement?.tagName,
     text: document.activeElement?.textContent?.trim().slice(0, 80)
   })
   ```

4. Check whether focus is on **Confirm Purchase**, the page body, or another unexpected control. Record the **actual** value, not an assumed outcome.
5. Repeat after the fix. Focus should land on **Confirm Purchase**; after Confirm Purchase or Cancel Reservation, it should move to the status message.

**Evidence files:** `evidence/ai-03-before.png` and `evidence/ai-03-after.png` — **PENDING**.

### Engineering Refactor

Track the intended focus destination before dispatching a checkout transition, then focus the new DOM target inside a layout effect after React updates the UI:

```tsx
const pendingFocusRef = useRef<
  | { target: "confirm"; reservationId: string }
  | { target: "feedback" }
  | null
>(null);

useLayoutEffect(() => {
  const pending = pendingFocusRef.current;
  if (!pending) return;
  pendingFocusRef.current = null;

  if (pending.target === "confirm") {
    const button = confirmButtonRefs.current.get(pending.reservationId);
    if (button?.isConnected) {
      button.focus();
      return;
    }
  }
  feedbackRef.current?.focus();
}, [state]);
```

Assign `ref` to the Confirm Purchase button, make the feedback paragraph programmatically focusable with `tabIndex={-1}`, and set `pendingFocusRef` in the transition handler. Keep countdown and unrelated updates from stealing focus.

### Verification — PENDING

- [ ] Tab/Enter on Begin Checkout moves focus to Confirm Purchase.
- [ ] Confirm Purchase, Cancel Reservation, and Simulate Payment Failure move focus to the transaction feedback.
- [ ] Tab and Shift+Tab remain logical at 375 px and 320 px widths.
- [ ] Test with Windows Narrator or NVDA where available.
- [ ] Screenshots and Console output show before/after focus location.

---

## 5. Regression Test and Refactoring Procedure

The original source must be documented **before** copying the fixes. The provided `apply_t10_fixes.mjs` performs narrowly scoped replacements against the reviewed file excerpts and refuses to continue if those excerpts changed. **The student must inspect `git diff`, run the tests, and confirm the interaction results independently.**

From `Homework_3/`:

```powershell
# Step A — On the original code, prepare a failing regression test:
node .\apply_t10_fixes.mjs --prepare
cd app
npx vitest run src/inventory/optimistic-lock.test.ts
cd ..

# Step B — AFTER collecting before-fix evidence:
node .\apply_t10_fixes.mjs
cd app
npx vitest run
npm run build
cd ..

# Step C — Review changed application files:
git diff -- app/src
```

**Do not mark the following as completed until observed:**

| Check | Before fix (expected / not yet recorded) | After fix (expected / not yet recorded) | Actual / evidence |
|---|---|---|---|
| AI-01 stale version guard | Regression test fails | Regression test passes | **PENDING** |
| AI-01 20 customers / 5 stock | Max five reservations; 19 conflict counters | Max five reservations; genuine conflicts followed by one retry | **PENDING** |
| AI-02 reset countdown | Sold returns from one to zero | Sold remains one | **PENDING** |
| AI-03 begin checkout | Focus may fall to body | Focus on Confirm Purchase | **PENDING** |
| Existing timer and FSM tests | Baseline previously implemented | All tests pass | **PENDING** |
| TypeScript/Vite build | Baseline previously implemented | Build passes | **PENDING** |

### Evidence checklist

Create `Homework_3/evidence/`, capture **actual** screenshots, and update the evidence status above:

- `ai-01-before.png` — DevTools/source and/or failing Vitest assertion demonstrating missing version enforcement.
- `ai-01-after.png` — passing regression test and reservation results after refactor.
- `ai-02-before.png` — DevTools Console showing **Sold = 0** after resetting the countdown despite a prior completed purchase (capture the prior Sold = 1 as part of evidence if possible).
- `ai-02-after.png` — **Sold = 1** preserved after countdown reset.
- `ai-03-before.png` — DevTools focus target after the original Begin Checkout transition.
- `ai-03-after.png` — focus on Confirm Purchase after the repair.
- `lighthouse-t09.png` — optional copy of the actual T09 Lighthouse screenshot (95/100/96/82).

**If a finding does not reproduce on the actual browser, write the observed result and revisit the claim. Never manufacture screenshots or observed Console results.**

## 6. Engineering Conclusion (Provisional)

The AI-assisted implementation provides a working educational state machine and accessible-looking UI, but automated tests and Lighthouse alone did not establish all business and interaction invariants. The identified defects illustrate three distinct failure modes: a missing concurrency precondition, accidental React state destruction through unstable component identity, and focus loss after a dynamic UI update. The prepared remediations make local version checks explicit, preserve inventory state across countdown resets, and manage focus after checkout transitions.

**Final audit status: PENDING VERIFICATION.** Fill in real local evidence and test results, review the diff, and only then change finding statuses from `PENDING` to `VERIFIED`.
