# Task Decomposition — HW 1: Production Enterprise Data Grid

**Course:** Web Application Development (Practical)  
**Assignment:** Homework 1 — Production Enterprise Data-Grid  
**Delivery window:** 1 week  
**Target:** WCAG 2.2 Level AA, verified Lighthouse **100/100 Accessibility** and **100/100 Best Practices**  
**Status:** Planning document; no implementation tasks are marked complete.

> This document is a task-by-task implementation and verification plan based on the supplied assignment screenshot. WCAG 2.2 AA is the *accessibility standard governing the implementation*, not a special Markdown formatting specification.

## 1. Assignment Requirements (Source of Truth)

| ID | Mandatory requirement from the assignment | Evidence of completion |
| --- | --- | --- |
| R-01 | A reusable, full-featured accessible Data Grid | Component renders user-supplied data and columns. |
| R-02 | Sorting | Sort only columns marked `sortable`, with a visible and accessible sort state. |
| R-03 | Filtering | Users can filter grid records with a labeled input. |
| R-04 | Pagination | Users can move between result pages with accessible controls. |
| R-05 | WCAG 2.2 Level AA | Applicable Level A and AA success criteria are checked manually and with automated tools. |
| R-06 | Minimum **4.5:1 text contrast** | Normal-sized text passes contrast checks (subject to WCAG exceptions); non-text UI cues are also checked. |
| R-07 | Full screen-reader support | Labels, header associations, row/column structure, state, and updates are communicated. |
| R-08 | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` navigate cells | Keyboard-only navigation works with predictable focus management. |
| R-09 | `Enter` selects a row | Pressing Enter while a body cell is active selects its row. |
| R-10 | `Space` toggles row selection | Pressing Space while a body cell is active toggles the row's selected state. |
| R-11 | Native semantic table; **no div-soup** | Use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, and real `<button>` controls. |
| R-12 | Full ARIA grid semantics | Use a valid `role="grid"` structure with row and grid-cell semantics. |
| R-13 | Lighthouse: **100/100 Accessibility** | Save the report demonstrating the actual score. |
| R-14 | Lighthouse: **100/100 Best Practices** | Save the report demonstrating the actual score. |
| R-15 | TypeScript component contract | Preserve the interface shown below exactly unless a change is approved. |

### 1.1 Required TypeScript Contract

Create `data-grid-contract.ts` (or place the interface in the location required by the existing project, keeping its public API unchanged):

```ts
export interface ColumnDef<T> {
  header: string;
  accessorKey: keyof T;
  sortable?: boolean;
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowSelect?: (item: T) => void;
  ariaLabel: string;
}
```

**Contract rule:** Do not silently add required props, rename properties, or weaken types to `any`. Document optional internal behavior separately.

### 1.2 Reasonable Defaults Requiring Confirmation if the Instructor Specifies Otherwise

- **Framework:** Keep the repository's existing framework and toolchain. The screenshot specifies TypeScript interfaces but does not require React, Vue, Vite, or a testing library.
- **Filtering:** A case-insensitive search across readable values of displayed columns. Clear-filter support is recommended.
- **Sorting:** One active sort column at a time; ascending and descending states. An optional unsorted state may be added if consistently explained.
- **Pagination:** Client-side pagination with a documented initial page size (e.g. 10); visible page and result counts.
- **Selection:** The component maintains row-selection state internally. `onRowSelect` is called when a row becomes selected. The given callback cannot explicitly report deselection; do not imply that it does.
- **Identity:** A stable row-identity strategy must be defined without relying on the current displayed row index after sorting/filtering. If duplicate values or replacement records make stable identity impossible under the supplied API, ask for an approved assumption or extension.
- **Scope:** No backend, server-side pagination, editable cells, virtualization, or external data-grid library unless requested or explicitly approved.

## 2. Dependency Graph and Delivery Order

```text
T00 Requirements and project baseline
  └─ T01 Project setup and TypeScript contract
       └─ T02 Semantic grid rendering
            ├─ T03 ARIA structure and keyboard focus
            │    └─ T04 Row selection
            ├─ T05 Sorting
            ├─ T06 Filtering
            └─ T07 Pagination
                 └─ T08 Integrated interaction and edge cases
                      └─ T09 WCAG 2.2 AA visual and responsive checks
                           └─ T10 Automated/manual testing and Lighthouse
                                └─ T11 Documentation, commits, submission
```

Tasks T05–T07 can be built separately after T02, but their final integration (T08) depends on all three. Accessibility checks begin at T02 and continue throughout; T09 is not the first time accessibility is considered.

## 3. Atomic Task Checklist

### T00 — Confirm Requirements and Inspect the Existing Project

**Goal:** Establish a safe baseline before writing code.

- [ ] **T00.1** Inspect the actual repository tree, source files, existing framework, and package scripts.
- [ ] **T00.2** Find the folder containing `package.json` (if npm is used); run commands only from the correct folder.
- [ ] **T00.3** Confirm the current Git branch, working-tree state, and configured remote without changing them.
- [ ] **T00.4** Record the required features R-01 through R-15 as acceptance criteria.
- [ ] **T00.5** Confirm or document assumptions on filtering, pagination, row identity, and selection callback behavior.
- [ ] **T00.6** Decide where demo data, the component, unit tests, and audit evidence will live.

**Done when:** The entry point, framework, run command, and intended file locations are known; no existing work has been overwritten.

### T01 — Project Setup and TypeScript API

**Goal:** Establish a compilable project and preserve the provided interface.

- [ ] **T01.1** Initialize tooling only if no valid project exists; otherwise reuse existing dependencies.
- [ ] **T01.2** Add `data-grid-contract.ts` with the exact `ColumnDef<T>` and `DataGridProps<T>` interfaces.
- [ ] **T01.3** Define a typed sample dataset with realistic values, including at least 25 records for pagination testing.
- [ ] **T01.4** Define valid column definitions with both sortable and non-sortable examples.
- [ ] **T01.5** Create the minimum demo page that supplies `data`, `columns`, and `ariaLabel`.
- [ ] **T01.6** Run the project's actual type-check/build command and resolve errors.

**Done when:** The contract compiles and the demo data is ready; no `any`-based workaround is needed.

### T02 — Native Table Structure and Generic Rendering

**Goal:** Render tabular data without div-based substitutes for table semantics.

- [ ] **T02.1** Build a generic `DataGrid<T>` that receives the specified props.
- [ ] **T02.2** Render real `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, and `<td>` elements.
- [ ] **T02.3** Label the grid using the supplied `ariaLabel` with a valid accessible-name mechanism.
- [ ] **T02.4** Render headers from `columns` and values using each column's `accessorKey`.
- [ ] **T02.5** Use actual `<button type="button">` elements for actions; keep layout wrappers separate from the table's structural elements.
- [ ] **T02.6** Handle no data, no columns, nullish cell values, and long text without crashes or misleading output.

**Done when:** The DOM has valid native table markup, column headers match data cells, and the empty state is understandable.

### T03 — WAI-ARIA Grid Semantics and Four-Direction Navigation

**Goal:** Implement an interactive composite grid rather than only a static table.

- [ ] **T03.1** Apply `role="grid"` to the native `<table>`.
- [ ] **T03.2** Ensure each `<tr>` exposes `row` semantics and each data `<td>` exposes `gridcell` semantics (native mappings are acceptable when they are correctly exposed; explicit roles may be used if required by the rubric).
- [ ] **T03.3** Ensure headers expose `columnheader` semantics; retain `<th scope="col">`.
- [ ] **T03.4** Implement a **roving `tabIndex` strategy** so only one grid navigation target belongs to the page Tab sequence at a time.
- [ ] **T03.5** Implement `ArrowRight` / `ArrowLeft` within a row and `ArrowDown` / `ArrowUp` within a column.
- [ ] **T03.6** Do not wrap across row or column boundaries unless explicitly documented; use the WAI-ARIA data-grid pattern as default.
- [ ] **T03.7** Preserve valid focus when rows change through sorting, filtering, or pagination; move focus to a sensible, visible fallback when needed.
- [ ] **T03.8** Ensure sortable header controls participate in the grid focus strategy; normal `Enter`/`Space` activation of a focused header button must not trigger body-row selection.
- [ ] **T03.9** Do not intercept arrow keys while focus is inside a text input or another control that needs its normal keyboard behavior.
- [ ] **T03.10** Ensure `Tab` and `Shift+Tab` can enter and exit the grid; no keyboard trap.
- [ ] **T03.11** Make the active cell and keyboard focus visible, including during scroll.

**Done when:** Every existing cell is reachable by keyboard, focus never becomes lost, and assistive technology receives grid/row/cell context.

### T04 — Accessible Row Selection

**Goal:** Match the assignment's exact keyboard contract.

- [ ] **T04.1** Define and document the selected-row state and stable row-identity approach.
- [ ] **T04.2** When focus is on a body cell, `Enter` **selects** the corresponding row.
- [ ] **T04.3** When focus is on a body cell, `Space` **toggles** the corresponding row's selection.
- [ ] **T04.4** Expose selection with `aria-selected="true"` / `"false"` at a consistent supported row level.
- [ ] **T04.5** Use visible styling and a non-color-only indicator or text for selected state.
- [ ] **T04.6** Call `onRowSelect(item)` for the documented select action, if a handler was supplied.
- [ ] **T04.7** Verify that selection and callback always refer to the correct original data item after sorting, filtering, or changing pages.
- [ ] **T04.8** Guard against selection firing when the user activates filtering, sorting, or pagination controls.

**Done when:** Enter selects, Space toggles, selected state is conveyed visually and programmatically, and callbacks identify the correct record.

### T05 — Sorting

**Goal:** Support accessible, predictable sorting.

- [ ] **T05.1** Render a native sort button in a header only when `sortable === true`.
- [ ] **T05.2** Track the active sort column and direction in component state.
- [ ] **T05.3** Sort a copied array; never mutate the incoming `data` prop.
- [ ] **T05.4** Handle strings, numbers, missing values, and ties deterministically; use locale-aware string comparison where appropriate.
- [ ] **T05.5** Put `aria-sort="ascending"` or `"descending"` **on the currently sorted `<th>`**, not on the button or every header.
- [ ] **T05.6** Give the sort button an accessible name containing its visible header text; indicate the current or next sort action clearly.
- [ ] **T05.7** Make sort state visually perceivable without relying on a lone icon or color.
- [ ] **T05.8** Verify focus is retained or restored after the sorted order changes.

**Done when:** Mouse, keyboard, and screen-reader users can sort eligible columns and determine the sorting result.

### T06 — Filtering

**Goal:** Enable a useful, accessible record search.

- [ ] **T06.1** Add a properly labeled text input outside the grid or in a clearly accessible toolbar.
- [ ] **T06.2** Implement case-insensitive filtering of readable values in the displayed columns.
- [ ] **T06.3** Add a clear/reset mechanism with an accessible name.
- [ ] **T06.4** Announce result-count changes through a concise status message (`role="status"` or another suitable polite live region).
- [ ] **T06.5** Display a meaningful “No matching results” state.
- [ ] **T06.6** Reset or clamp the current page after filtering so a nonexistent page is never shown.
- [ ] **T06.7** Do not steal focus from the search input while the user types.

**Done when:** Filtering is keyboard-operable, easy to clear, updates pagination correctly, and communicates results nonvisually.

### T07 — Pagination

**Goal:** Split the filtered/sorted dataset into understandable pages.

- [ ] **T07.1** Define and document the page size; calculate the valid page count from filtered results.
- [ ] **T07.2** Apply transformations in this order: **filter → sort → paginate** (equivalent ordering for independent filter/sort is acceptable if behavior remains deterministic).
- [ ] **T07.3** Add native `Previous` and `Next` buttons with meaningful accessible names.
- [ ] **T07.4** Disable or otherwise make unavailable invalid previous/next actions without creating a confusing focus state.
- [ ] **T07.5** Show current page, total pages, and record range/count in text.
- [ ] **T07.6** Announce page changes through a suitable status region without excessive announcements.
- [ ] **T07.7** Repair cell focus appropriately when the currently focused row is removed from the DOM.
- [ ] **T07.8** Verify first/last page, one-page, zero-result, and partial-last-page behavior.

**Done when:** No record is unexpectedly skipped or duplicated by page calculation, and page controls work using mouse and keyboard.

### T08 — Integration, State Coordination, and Robustness

**Goal:** Make all mandatory features work together.

- [ ] **T08.1** Test the sequence: filter → sort → select → next page → previous page.
- [ ] **T08.2** Test the sequence: select → sort → filter → clear filter; ensure the intended row remains correctly identified if still present.
- [ ] **T08.3** Test empty inputs, duplicate values, long strings, null values, and changing prop data.
- [ ] **T08.4** Prevent inconsistent page, sort, selection, and focus states after dataset updates.
- [ ] **T08.5** Verify no console errors, unhandled exceptions, invalid DOM nesting, or duplicate accessible names/IDs.
- [ ] **T08.6** Confirm the component stays reusable without depending on a particular demo dataset.

**Done when:** Every feature still works after any other feature changes the displayed set of rows.

### T09 — WCAG 2.2 AA Presentation and Manual Accessibility

**Goal:** Meet relevant accessibility success criteria and prevent visual/interaction regressions.

- [ ] **T09.1** Check normal-text contrast at **at least 4.5:1** (SC 1.4.3); check large text under the applicable 3:1 requirement and exceptions.
- [ ] **T09.2** Check relevant UI boundaries, focus/selection indicators, and meaningful icons at **at least 3:1** where SC 1.4.11 applies.
- [ ] **T09.3** Provide a clearly visible keyboard focus indicator (SC 2.4.7); ensure focus is not entirely obscured (SC 2.4.11).
- [ ] **T09.4** Check pointer target dimensions or allowed spacing/exceptions under **SC 2.5.8** (24 × 24 CSS px minimum, with defined exceptions). Prefer comfortably larger targets where practical.
- [ ] **T09.5** Test keyboard-only access, logical focus sequence, no trap, and full operation (SC 2.1.1, 2.1.2, 2.4.3).
- [ ] **T09.6** Test labels, instructions, accessible names, role/state/value, and header relationships (SC 1.3.1, 2.4.6, 2.5.3, 3.3.2, 4.1.2, as applicable).
- [ ] **T09.7** Confirm updates to sorting, filtering, selection, and pagination are understandable to a screen reader (SC 4.1.3 for applicable status messages).
- [ ] **T09.8** Test text resizing, 200% zoom, 400% zoom / reflow, and text-spacing adjustments (SC 1.4.4, 1.4.10, 1.4.12). For actual data tables, two-dimensional scrolling can be permissible under the SC 1.4.10 exception; avoid clipping and lost context.
- [ ] **T09.9** Confirm selection is not communicated through color alone (SC 1.4.1).
- [ ] **T09.10** Test desktop/mobile viewports and light/dark appearance only if supported; avoid hidden focus or clipped controls.

**Done when:** All applicable A and AA requirements have documented results and outstanding issues have been fixed.

### T10 — Testing, Lighthouse Audit, and Evidence

**Goal:** Collect defensible, reproducible verification evidence.

- [ ] **T10.1** Run type checking, linting (if configured), and a production build; record actual commands used.
- [ ] **T10.2** Add or run targeted automated tests using the project's installed tools (or obtain approval before adding new dependencies).
- [ ] **T10.3** Test keyboard-only scenarios: grid entry/exit, all four arrow keys, Enter, Space, sorting, filtering, pagination, and boundaries.
- [ ] **T10.4** Test with a screen reader (e.g., NVDA + Chrome on Windows), including header identification, selected state, and result announcements.
- [ ] **T10.5** Run an automated accessibility checker such as axe-core/axe DevTools when available; resolve issues and review warnings manually.
- [ ] **T10.6** Run Lighthouse on the actual final page (mobile and desktop when practical), selecting **Accessibility** and **Best Practices**.
- [ ] **T10.7** Achieve and **verify** **100/100** for both required Lighthouse categories; do not report success before the audit confirms it.
- [ ] **T10.8** Save reproducible audit output (HTML/JSON or screenshots) and record the browser, URL, build version/commit, viewport, and date.
- [ ] **T10.9** Run the audit again after any fixes and attach the final, not a stale, report.
- [ ] **T10.10** Clearly distinguish automated Lighthouse scores from WCAG conformance; a perfect automated score **does not prove** full WCAG 2.2 AA compliance.

**Done when:** The two requested Lighthouse scores are actually 100/100 and manual WCAG/keyboard/screen-reader checks are recorded.

### T11 — Documentation, Git, and Submission

**Goal:** Package the finished homework so it can be run and assessed.

- [ ] **T11.1** Prepare a short `README.md` with setup, scripts, launch URL, project structure, and feature list.
- [ ] **T11.2** Explain the documented keyboard commands and any assumptions or limitations.
- [ ] **T11.3** Include this file and `ai_rule.md` at the repository root, unless the instructor has specified another location.
- [ ] **T11.4** Confirm no secrets, irrelevant large artifacts, or generated dependency folders are committed.
- [ ] **T11.5** Review `git status` and `git diff` before each commit.
- [ ] **T11.6** Make focused commits after working milestones; suggested messages are below.
- [ ] **T11.7** Push to the correct assigned remote only after the destination and current branch have been verified.
- [ ] **T11.8** Verify the remote contains all required source files, documentation, and audit evidence expected by the instructor.

**Done when:** The repository is reproducible, the submission is complete, and the correct remote/branch is confirmed.

## 4. Verification Matrix (WCAG 2.2 Level AA)

The following are the **highest-priority applicable** success criteria, not a claim that every possible WCAG requirement is covered by this table. Review all applicable Level A and AA criteria for the final page.

| WCAG SC | Level | Grid-specific check | Verification method |
| --- | --- | --- | --- |
| 1.3.1 Info and Relationships | A | Native table structure, column headers, header/data associations | DOM + screen reader |
| 1.4.1 Use of Color | A | Sort and selection not conveyed through color alone | Visual/manual |
| 1.4.3 Contrast (Minimum) | AA | 4.5:1 for ordinary text; 3:1 for large text, subject to criteria exceptions | Contrast checker |
| 1.4.4 Resize Text | AA | 200% text resize without loss of content/functionality | Browser/manual |
| 1.4.10 Reflow | AA | Content at equivalent 320 CSS px width; check the data-table two-dimensional-scroll exception properly | Browser/manual |
| 1.4.11 Non-text Contrast | AA | Important control and state visuals at least 3:1 | Contrast checker |
| 1.4.12 Text Spacing | AA | Increased line/word/letter/paragraph spacing does not cause loss | Custom CSS/manual |
| 2.1.1 Keyboard | A | All grid operations possible with keyboard | Keyboard-only |
| 2.1.2 No Keyboard Trap | A | Enter and exit via Tab / Shift+Tab | Keyboard-only |
| 2.4.3 Focus Order | A | Predictable toolbar, grid, and pagination sequence | Keyboard-only |
| 2.4.6 Headings and Labels | AA | Descriptive labels for filter, grid, sort, and page controls | Accessibility tree |
| 2.4.7 Focus Visible | AA | Focus indicator visible on every active control/cell | Visual/manual |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focus target not completely covered by sticky content | Keyboard/scroll |
| 2.5.3 Label in Name | A | Visible labels are contained in corresponding accessible names | Accessibility tree |
| 2.5.8 Target Size (Minimum) | AA | 24 × 24 CSS px or valid spacing/other exception | Browser/manual |
| 3.3.2 Labels or Instructions | A | Filtering input clearly labeled | DOM/manual |
| 4.1.2 Name, Role, Value | A | Grid/button names, roles, and selected/sorted states | Accessibility tree + screen reader |
| 4.1.3 Status Messages | AA | Results/page updates announced without moving focus | Screen reader |

**Important distinctions:** 2.4.13 *Focus Appearance* is **AAA**, not a required AA success criterion. SC 4.1.1 *Parsing* was removed from WCAG 2.2 and should not be treated as a separate WCAG 2.2 test requirement. Valid, robust HTML is still necessary.

## 5. Critical Manual Acceptance Scenarios

| Scenario | Actions | Expected result |
| --- | --- | --- |
| K-01 Enter the grid | Tab from the previous control | Exactly one grid navigation target receives focus. |
| K-02 Direction keys | Press Left, Right, Up, Down | Focus moves to the adjacent valid cell with no accidental scrolling. |
| K-03 Boundary handling | Press arrows at first/last row/column | Focus remains on a valid target and never disappears. |
| K-04 Select | Focus a body cell and press Enter | Corresponding row becomes selected; callback receives correct item. |
| K-05 Toggle | Focus a body cell and press Space twice | Selection toggles on, then off. |
| K-06 Header button | Focus a sort control and press Enter or Space | Correct sort applies; body-row selection does not fire. |
| K-07 Keyboard exit | Press Tab / Shift+Tab | User can leave the grid in the expected sequence. |
| K-08 Filter result | Type a query, then clear it | Results and status update; input retains focus. |
| K-09 Pagination | Next / Previous / first / last page | Page numbers and displayed rows are correct. |
| K-10 Data changes | Select, sort, filter, and paginate repeatedly | No wrong callback target, stale focus, or inconsistent selection. |
| K-11 Screen reader | Navigate headers and selected rows | Row/column context and state are understandable. |
| K-12 Zoom | Use 200% and 400% zoom | Controls stay usable; permitted data-table scrolling does not lose information. |
| K-13 Automated audit | Run Lighthouse on the final build | Accessibility = 100, Best Practices = 100, with saved evidence. |

## 6. Suggested Seven-Day Schedule

| Day | Tasks | Daily checkpoint |
| --- | --- | --- |
| 1 | T00–T01 | Baseline confirmed; TypeScript contract compiles. |
| 2 | T02–T03 | Semantic table and working keyboard cell navigation. |
| 3 | T04–T05 | Row selection and accessible sorting work. |
| 4 | T06–T07 | Filtering and pagination work separately. |
| 5 | T08 | All features work together, including edge cases. |
| 6 | T09–T10 | WCAG checks, manual AT testing, Lighthouse fixes. |
| 7 | T10–T11 | Final re-audit, evidence, README, Git submission. |

The schedule is a plan, not evidence of completion. Complete and verify each checkpoint before moving on.

## 7. Suggested Git Checkpoints

The repository may already contain commits or an instructor-prescribed commit schedule. If so, follow those requirements first.

1. `chore: inspect project and add homework requirements`
2. `feat: add typed data grid contract and semantic table`
3. `feat: implement accessible grid keyboard navigation`
4. `feat: implement row selection and column sorting`
5. `feat: add filtering and pagination`
6. `test: cover integrated grid interactions and accessibility`
7. `docs: add WCAG verification and Lighthouse evidence`

Do not combine unrelated changes or claim to have run checks you did not run. Do not push before verifying the destination.

## 8. Definition of Done

The assignment is complete only when **all** of the following are true:

- [ ] All mandatory features R-01 through R-15 work in the actual application.
- [ ] The TypeScript public interface remains compatible with the supplied contract.
- [ ] The grid uses native table and button elements with correct ARIA semantics.
- [ ] Every required keyboard interaction and edge-case scenario passes.
- [ ] The UI meets applicable WCAG 2.2 A and AA criteria after manual and automated checks.
- [ ] The final verified Lighthouse **Accessibility** score is **100/100**.
- [ ] The final verified Lighthouse **Best Practices** score is **100/100**.
- [ ] The code builds successfully, has no known blocking runtime errors, and is documented.
- [ ] The correct Git remote contains the intended deliverables.

## 9. Authoritative References

1. W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*: https://www.w3.org/TR/WCAG22/
2. W3C WAI, *Grid (Interactive Tabular Data and Layout Containers) Pattern*: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
3. W3C WAI, *Grid and Table Properties* (`aria-sort`, indices): https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/
4. W3C WAI, *What's New in WCAG 2.2*: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
5. Chrome for Developers, *Lighthouse Accessibility Scoring*: https://developer.chrome.com/docs/lighthouse/accessibility/scoring/

---

**Execution instruction:** Work on one atomic task at a time. Before marking any checkbox, verify its completion in the actual code or with real test evidence. The companion `ai_rule.md` defines the AI assistant's required behavior.
