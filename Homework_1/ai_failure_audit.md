# AI FAILURE AUDIT — Detecting Hallucinations, Security Holes, and UI Defects

**Project:** HW 1 — Production Enterprise Data Grid  
**Course:** Web Application Development (Practical)  
**Audit date:** 2026-10-21  
**Standard under review:** WCAG 2.2 Level AA, WAI-ARIA Authoring Practices  
**Primary source:** AI-generated `DataGrid.tsx` from T08; `App.css` and `index.css` from T09; the TypeScript contract, employee sample data, and `App.tsx` from earlier tasks.  
**Audit outcome:** **OPEN — code corrections and independent verification are still required.**

> **Evidence limitation:** This is a *static review of the code shared in the conversation*, not a claim that the current GitHub repository was fetched, the live application was executed, or a DevTools screenshot was captured. The excerpts below were present in the AI-provided code. All runtime proof is explicitly marked **PENDING** until the student reproduces the case and saves evidence. A potential failure under changing data is not asserted to occur with the existing static 30-employee dataset.

## 1. Scope, Verification Method, and Severity

The instructor's sample documents each finding using **AI Prompt → AI-generated Code → Risk → Detection → Engineering Refactor**. This report follows that structure for more than three issues. It distinguishes **observed code defects or design gaps** from **conditional failure scenarios** and **unverified claims**.

- **Static-detected:** the code excerpt itself confirms the reported implementation or omission.
- **Conditional risk:** the failure is reproducible when specified input/data changes occur; it may not manifest in the current static demonstration.
- **Verification gap:** no saved tool output or manual test report has established the claimed result.
- **Severity:** HIGH = selection/accessibility correctness; MEDIUM = data identity, component API, or screen-reader completeness; LOW = documentation/usability refinement.

## 2. Summary of Findings

| ID | Severity | Status | Failure mode | Location |
|---|---|---|---|---|
| AF-01 | HIGH | Static-detected; runtime reproduction pending | Object-reference-based selection loses identity when objects are refreshed | `app/src/components/DataGrid.tsx` |
| AF-02 | MEDIUM | Static-detected; conditional | Index-based React keys can attach old DOM state to different records after input-list mutations | `app/src/components/DataGrid.tsx` |
| AF-03 | MEDIUM | Static-detected | Paginated ARIA grid omits overall row count and logical row indices | `app/src/components/DataGrid.tsx` |
| AF-04 | MEDIUM | Static-detected | Generic component contains employee-specific search labeling | `app/src/components/DataGrid.tsx` |
| AF-05 | MEDIUM | Static-detected; impact depends on consumer | Deselecting a row does not notify the `onRowSelect` consumer of changed selection | `app/src/components/DataGrid.tsx` |
| AF-06 | MEDIUM | Verification gap | No independently recorded Lighthouse and screen-reader evidence was supplied | Audit and submission evidence |
| AF-07 | LOW | Verification gap | Document title and production metadata were not reviewed | `app/index.html` |
| AF-08 | LOW | Enhancement, not a confirmed WCAG failure | Home/End shortcuts and sort-change announcements are absent | `app/src/components/DataGrid.tsx` |

**Priority:** Fix AF-01 and AF-02 together using stable row IDs; address AF-03 and AF-04; review AF-05 against the required fixed interface; capture evidence for AF-06 and AF-07.

## 3. Detailed AI Failure Audit Entries

### Vulnerability / Failure 01 — Unstable Row Identity in Selection

**Severity:** HIGH  
**Classification:** Static-detected design flaw; reproducible if a parent refreshes data into new objects.  
**AI Prompt:** "Implement row selection that continues to work after sorting, filtering, and pagination."

**AI-Generated Code:**

```tsx
const [selectedRows, setSelectedRows] = useState<T[]>([]);

const validSelectedRows = selectedRows.filter((item) =>
  data.includes(item)
);

const isSelected = validSelectedRows.includes(item);
```

**Risk:** `Array.includes` compares object references, not record identities. A refreshed dataset such as `employees.map(employee => ({ ...employee }))` contains new objects with the same IDs. Previously selected employees are then considered unselected. If two rows reuse the same object instance, selecting one also visually selects the other. This may misrepresent user intent in an enterprise grid.

**Detection — DevTools proof to capture (PENDING):**

1. In the application, select employee ID 1 and verify the status says one row selected.
2. Temporarily replace the `data` prop with an equivalent list of newly cloned objects (for example, `employees.map(item => ({ ...item }))`) triggered by a test button, not by modifying the DOM in DevTools.
3. In **Elements**, inspect the employee ID 1 `<tr>` for `aria-selected` and compare it with the UI status.
4. Save screenshots **before** and **after** the data refresh as `evidence/AF-01-before.png` and `evidence/AF-01-after.png`.

**Engineering Refactor — manual fix:** Use a stable unique row ID from the record, rather than object equality. Keep the instructor's required `ColumnDef<T>` and `DataGridProps<T>` definitions unchanged. If an additional optional component prop is permitted, it can be introduced separately:

```tsx
type RowId = string | number;

type DataGridRuntimeProps<T> = DataGridProps<T> & {
  getRowId?: (item: T) => RowId;
};

// In App.tsx, for employees with unique numeric IDs:
<DataGrid
  data={employees}
  columns={columns}
  ariaLabel="Employee information grid"
  getRowId={(employee) => employee.id}
/>

// Within DataGrid, when getRowId is supplied:
const [selectedIds, setSelectedIds] = useState<Set<RowId>>(
  () => new Set()
);

const isSelected = selectedIds.has(getRowId(item));
```

The example above illustrates the identity strategy, **not a complete drop-in replacement** for `DataGrid.tsx`. Complete the select/toggle logic, the active-cell state, and the keys using the same ID. If extending the component API is prohibited, document that the exact required interface does not expose a universal row-ID accessor and ask the instructor which property may serve as a unique ID.

**Acceptance:** Selection remains attached to the same employee ID across sorting, filtering, pagination, and data refreshes.

### Vulnerability / Failure 02 — Positional React Keys ("Phantom Keys" Risk)

**Severity:** MEDIUM  
**Classification:** Static-detected use of input indices; conditional reconciliation problem.  
**AI Prompt:** "Render paginated, sorted records with stable React state."

**AI-Generated Code:**

```tsx
const rows = data.map((item, index) => ({ item, index }));

// Later, after filtering and sorting:
<tr key={originalIndex} role="row" aria-selected={isSelected}>
```

**Risk:** `originalIndex` stays constant during sorting/filtering/pagination **if `data` stays in the same order**, so this is not an observed problem in the provided immutable 30-row example. However, inserting, deleting, or reordering records in the incoming `data` array can reuse a React key for a different employee. React may then preserve DOM identity, focus, or local row state for the wrong logical record. This is a classic index-key failure mode, *not* the same as using `Math.random()`.

**Detection — DevTools proof to capture (PENDING):**

1. In a controlled test, select or focus an employee row.
2. Prepend a new employee to the source array without changing existing employee IDs.
3. Inspect the focused cell and selected employee identity after rendering; record any mismatch.
4. Save `evidence/AF-02-list-mutation.png` and document whether the issue reproduced.

**Engineering Refactor — manual fix:** Once the stable ID strategy from AF-01 is implemented, use the same stable ID as the React key:

```tsx
// Replaces key={originalIndex}; getRowId must return a stable unique value.
<tr key={getRowId(item)} role="row" aria-selected={isSelected}>
```

Avoid `key={Math.random()}` and `key={rowIndex}`. Verify that IDs are unique among siblings and persist through refreshes.

**Acceptance:** Insert/reorder/delete operations do not transfer visible selection or focus to a different record.

### Vulnerability / Failure 03 — Incomplete ARIA Metadata for Paginated Rows

**Severity:** MEDIUM  
**Classification:** Static-detected accessibility semantics gap.  
**AI Prompt:** "Create an accessible ARIA data grid with ten records per page."

**AI-Generated Code:**

```tsx
<table role="grid" aria-label={ariaLabel} aria-multiselectable="true">
  <thead><tr role="row">...</tr></thead>
  <tbody>
    {pageRows.map(({ item, index: originalIndex }, rowIndex) => (
      <tr key={originalIndex} role="row" aria-selected={isSelected}>
        ...
      </tr>
    ))}
  </tbody>
</table>
```

**Risk:** The DOM contains a header and only the current page of rows, although the filtered grid can contain many more. Without `aria-rowcount` and `aria-rowindex`, assistive technology may infer an incorrect overall row count and page-relative positions. W3C's Grid and Table Properties guidance specifically addresses partial DOM representations.

**Detection — DevTools proof to capture (PENDING):**

1. Navigate to page 3 with the 30-employee dataset.
2. Open **Chrome DevTools → Elements → Accessibility**.
3. Inspect `<table role="grid">` and a visible `<tr role="row">`; note the lack of `aria-rowcount` and `aria-rowindex` in the current source/DOM.
4. Save `evidence/AF-03-before.png`, apply the fix, then save `evidence/AF-03-after.png`.
5. Confirm the announcement using NVDA; DevTools alone is not a screen-reader test.

**Engineering Refactor — manual fix:** For a nonempty data page, include the header row in the total, and offset body rows by their position within filtered results:

```tsx
<table
  role="grid"
  aria-label={ariaLabel}
  aria-rowcount={totalRecords > 0 ? totalRecords + 1 : undefined}
  aria-multiselectable="true"
>
  <thead>
    <tr role="row" aria-rowindex={totalRecords > 0 ? 1 : undefined}>
      {/* column headers */}
    </tr>
  </thead>
  <tbody>
    {pageRows.map(({ item }, rowIndex) => (
      <tr
        key={getRowId(item)}
        role="row"
        aria-rowindex={startIndex + rowIndex + 2}
      >
        {/* cells */}
      </tr>
    ))}
  </tbody>
</table>
```

The `getRowId` line assumes AF-01/AF-02 have already been refactored. Retain the existing `aria-describedby`, `aria-selected`, keyboard handlers, and column markup from the working component; the snippet is illustrative. For an empty-results placeholder row, omit these logical row indices and verify the empty-state experience separately. Invalid or inconsistent row indices can harm screen reader behavior.

**Acceptance:** Row-count and logical row-position information remain consistent across all three pages and after filtering.

### Vulnerability / Failure 04 — Hardcoded Employee UI Inside a Generic Component

**Severity:** MEDIUM  
**Classification:** Static-detected reusability defect.  
**AI Prompt:** "Implement a reusable `DataGrid<T>` component."

**AI-Generated Code:**

```tsx
<label htmlFor={searchId}>Search employees</label>
<input
  placeholder="Search employees..."
  type="search"
  ...
/>
```

**Risk:** `DataGrid<T>` is generic, but if a student reuses it for invoices, products, or registrations, users and screen readers will still be told to search *employees*. This is an accessible-name accuracy and component reusability problem, not an injection vulnerability.

**Detection — DevTools proof to capture (PENDING):** Render `DataGrid` using another data type and inspect the `<label>` accessible name in DevTools' Accessibility pane. Record that it still says "Search employees".

**Engineering Refactor — manual fix:** Use the already required `ariaLabel` as contextual text without modifying the instructor's public contract:

```tsx
<label htmlFor={searchId}>Search {ariaLabel}</label>
<input
  id={searchId}
  type="search"
  placeholder="Search records..."
  ...
/>
```

Alternatively, use a neutral "Search records" label. Keep visible labels associated with inputs via `htmlFor` / `id`.

**Acceptance:** The accessible search label remains accurate when the same grid component renders non-employee datasets.

### Vulnerability / Failure 05 — Selection Callback Does Not Report Deselection

**Severity:** MEDIUM  
**Classification:** Static-detected API behavior; whether it is a bug depends on consuming application requirements.  
**AI Prompt:** "Support selection and deselection while exposing the required `onRowSelect` callback."

**AI-Generated Code:**

```tsx
const toggleRow = (item: T) => {
  const isSelected = validSelectedRows.includes(item);
  setSelectedRows(
    isSelected
      ? validSelectedRows.filter((row) => row !== item)
      : [...validSelectedRows, item]
  );
  if (!isSelected) onRowSelect?.(item);
};
```

**Risk:** Pressing Space to deselect updates internal state, but the parent component is not told about that deselection. A parent that interprets `onRowSelect` as the complete selection-change feed can become out of sync. The provided TypeScript contract only declares `onRowSelect?: (item: T) => void`; it does **not** define a deselection callback, so this is an API limitation/ambiguity rather than a proven violation of the assignment.

**Detection — DevTools proof to capture (PENDING):** Attach a temporary `onRowSelect={(item) => console.log('select', item)}` callback in `App.tsx`. Select a row, then deselect it with Space. Compare Console messages with the visible selection count.

**Engineering Refactor — manual fix:** **Preserve the instructor's exact required interface.** Document that `onRowSelect` is invoked only when an item becomes selected. If external synchronization is required, request permission to add an *optional* event with explicit semantics, for example `onSelectionChange(selectedIds)`. Do **not** silently reinterpret the existing callback as deselection.

**Acceptance:** Callback semantics are documented and verified; any extra API is approved before implementation.

### Vulnerability / Failure 06 — Unsupported Claim of Full Accessibility Compliance

**Severity:** MEDIUM  
**Classification:** Verification gap / AI overclaim risk.  
**AI Prompt:** "Achieve verified 100/100 Lighthouse Accessibility and Best Practices and WCAG 2.2 AA."

**AI-Generated Guidance at Risk:** Statements that the project is complete or fully WCAG conformant based only on a successful build, CSS choices, or the student's short confirmation "done".

**Risk:** `npm run build` checks compilation; it does not establish screen-reader behavior, focus order, all contrast states, or Lighthouse scores. Automated scores themselves do not establish full WCAG conformance.

**Detection — evidence to capture (PENDING):**

1. Run `npm run build && npm run preview` in `app` (in PowerShell, use separate commands if preferred).
2. Audit the production preview using **Chrome DevTools → Lighthouse**, selecting **Accessibility** and **Best Practices**.
3. Save the HTML report as `evidence/lighthouse-report.html` and a screenshot of both actual scores.
4. Test keyboard navigation and NVDA; record observed results, including any failure.

**Engineering Refactor / process correction:** Replace unverified declarations with measured evidence: exact Lighthouse scores, browser/device, test date, screen-reader observations, known issues, and links to committed evidence files.

**Acceptance:** Neither `100/100` nor WCAG conformance is claimed without corresponding measured and manual evidence.

### Vulnerability / Failure 07 — Unverified HTML Document Metadata

**Severity:** LOW  
**Classification:** Verification gap, not a confirmed source defect.  
**AI Prompt:** "Deliver a production-quality Employee Data Grid application."

**Potential AI Omission:** Previous instructions did not include an explicit update to Vite's initial `app/index.html` title and description. The installed file was not inspected.

**Risk:** If left as Vite's default, the browser tab and document title will not meaningfully identify the application, reducing clarity for browser and assistive-technology users.

**Detection — DevTools proof to capture (PENDING):** Open DevTools Console and run `document.title`; inspect `app/index.html` to confirm the real value.

**Engineering Refactor — manual fix (only if needed):**

```html
<title>Enterprise Employee Data Grid</title>
<meta
  name="description"
  content="Accessible employee data grid with sorting, filtering, pagination, and keyboard navigation."
/>
```

**Acceptance:** Browser document title describes the application and is verified in the built preview.

### Vulnerability / Failure 08 — Missing Optional Grid Productivity Shortcuts

**Severity:** LOW  
**Classification:** Enhancement; **not** a confirmed WCAG 2.2 AA violation.  
**AI Prompt:** "Make the grid keyboard friendly and conform to WAI-ARIA guidance."

**AI-Generated Code:** `handleCellKeyDown` supports the required arrow keys plus Enter and Space, but has no cases for `Home`, `End`, `Ctrl+Home`, or `Ctrl+End`.

**Risk:** Users familiar with richer desktop grids may expect faster traversal. These shortcuts appear in the WAI-ARIA APG data grid keyboard guidance, but the instructor's screenshot explicitly requires only arrows, Enter, and Space; do not mistake missing optional functionality for a demonstrated assignment failure.

**Detection — DevTools proof to capture (PENDING):** Focus a cell, press Home/End, and record actual behavior and any browser-default scroll.

**Engineering Refactor — possible improvement:** Add keyboard cases after confirming they do not interfere with existing sort-button behavior. Keep required shortcuts unchanged and test focus after sorting/pagination.

**Acceptance:** Required controls still work; optional shortcuts are either implemented and tested or explicitly deferred.

## 4. Instructor's Three Classic AI Failure Modes — Truthful Verdict

The instructor's examples are *failure categories to investigate*, not bugs that may be invented merely to fill out a report.

| Classic mode | Evidence in the latest AI-provided implementation | Verdict |
|---|---|---|
| **1. Stored XSS via `innerHTML`** | Cells render strings as React JSX: `{String(item[column.accessorKey] ?? "—")}`. The shared code contains no raw `innerHTML` assignment or `dangerouslySetInnerHTML`. | **NOT DETECTED in reviewed code.** Test any future HTML-rendering feature separately. |
| **2. Memory leak via manual event listeners** | Grid event handlers use React `onKeyDown`, `onClick`, `onFocus`, etc.; no `window.addEventListener` or `document.addEventListener` in the reviewed component. | **NOT DETECTED in reviewed code.** No evidence of leaked native listeners. |
| **3. Phantom keys using `Math.random()` or indices** | No random keys; `key={originalIndex}` is present for rows. | **CONDITIONAL RISK DETECTED (AF-02).** Stable for the current unchanged source order, unsafe under insertion/reordering/deletion of incoming data. |

**Optional XSS-negative-control test:** Temporarily set an employee name in sample *data* to `'<img src=x onerror=alert(1)>'`. If rendered through the existing JSX string expression, inspect the text in **Elements** and check that no image is created and no alert runs. **Do not** inject a payload directly into DevTools' HTML editor, since that would bypass React's rendering behavior and would not test the component. Remove the test value before submission. **Evidence status: PENDING.**

## 5. DevTools Evidence, Manual Fix Record, and Acceptance

The teacher requires **three detected issues with DevTools proof and manual fixes**. The clearest candidates to demonstrate are **AF-01, AF-02, and AF-03**. They are backed by actual AI-generated code patterns, but **screenshots and runtime outcomes have not been fabricated**.

| Finding | Evidence filename to create | Expected proof | Current status |
|---|---|---|---|
| AF-01 | `evidence/AF-01-before.png`, `AF-01-after.png` | Selection behavior across an object-refresh scenario | PENDING |
| AF-02 | `evidence/AF-02-list-mutation.png` | Index-key behavior with inserted or reordered input records | PENDING |
| AF-03 | `evidence/AF-03-before.png`, `AF-03-after.png` | ARIA row count/index attributes in Elements → Accessibility | PENDING |
| Security negative control | `evidence/XSS-text-rendering.png` | Malicious-looking string appears as inert text | OPTIONAL / PENDING |
| Lighthouse | `evidence/lighthouse-report.html` | Actual Accessibility and Best Practices results | PENDING |

**Manual correction log (fill in after implementation):**

| ID | File changed | Fix commit SHA | Retest result | Verified by / date |
|---|---|---|---|---|
| AF-01 | _Pending_ | _Pending_ | _Pending_ | _Pending_ |
| AF-02 | _Pending_ | _Pending_ | _Pending_ | _Pending_ |
| AF-03 | _Pending_ | _Pending_ | _Pending_ | _Pending_ |

**Submission acceptance checklist:**

- [ ] At least three findings were *reproduced or directly evidenced* and accompanied by authentic DevTools proof.
- [ ] Original problematic code and the corrected code are documented for each selected finding.
- [ ] `npm run build` succeeds after fixes.
- [ ] Row identity, sorting, filtering, pagination, focus, and selection are re-tested.
- [ ] Lighthouse report and keyboard/screen-reader notes reflect real observations, not inferred scores.
- [ ] The **required `ColumnDef<T>` and `DataGridProps<T>` interfaces remain intact**; optional extensions require instructor approval if the contract is strict.

**Reference documentation:**

- W3C, *WCAG 2.2*: https://www.w3.org/TR/WCAG22/
- W3C, *ARIA Grid Pattern*: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- W3C, *Grid and Table Properties*: https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/
- React, *Rendering Lists — Keys*: https://react.dev/learn/rendering-lists
- Chrome DevTools, *Accessibility features*: https://developer.chrome.com/docs/devtools/accessibility/reference

**Final audit disposition:** **OPEN.** Static findings are documented; no claim is made that all repairs or DevTools verifications have been completed.
