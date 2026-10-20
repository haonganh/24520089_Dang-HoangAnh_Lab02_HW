
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { DataGridProps } from "./data-grid-contract";

const PAGE_SIZE = 10;

type ActiveCell<T> =
  | { type: "header"; col: number }
  | { type: "body"; item: T; col: number };

export default function DataGrid<T>({
  data,
  columns,
  ariaLabel,
  onRowSelect,
}: DataGridProps<T>) {
  const searchId = useId();
  const instructionsId = useId();

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const [active, setActive] = useState<ActiveCell<T>>({
    type: "header",
    col: 0,
  });

  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "ascending" | "descending";
  } | null>(null);

  const headerRefs = useRef<(HTMLElement | null)[]>([]);
  const cellRefs = useRef<(HTMLTableCellElement | null)[][]>([]);
  const gridHasFocus = useRef(false);

  // 1. Filter and sort records
  const processedRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const rows = data
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        !query ||
        columns.some((column) =>
          String(item[column.accessorKey] ?? "")
            .toLocaleLowerCase()
            .includes(query)
        )
      );

    if (!sortConfig) return rows;

    return [...rows].sort((a, b) => {
      const aValue = a.item[sortConfig.key];
      const bValue = b.item[sortConfig.key];

      if (aValue == null && bValue == null) {
        return a.index - b.index;
      }

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      const result =
        typeof aValue === "number" &&
        typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(
              String(bValue),
              "en",
              { numeric: true, sensitivity: "base" }
            );

      if (result === 0) return a.index - b.index;

      return sortConfig.direction === "ascending"
        ? result
        : -result;
    });
  }, [data, columns, search, sortConfig]);

  // 2. Pagination
  const totalRecords = processedRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRecords / PAGE_SIZE)
  );

  const currentPage = Math.min(pageIndex, totalPages - 1);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(
    startIndex + PAGE_SIZE,
    totalRecords
  );

  const pageRows = processedRows.slice(startIndex, endIndex);
  const firstRecord = totalRecords === 0 ? 0 : startIndex + 1;

  // Ignore stale selections when incoming data changes
  const validSelectedRows = selectedRows.filter((item) =>
    data.includes(item)
  );

  const activeRowIndex =
    active.type === "body"
      ? pageRows.findIndex(({ item }) => item === active.item)
      : -1;

  const activeColumn = Math.min(
    active.col,
    Math.max(0, columns.length - 1)
  );

  const headerIsActive =
    active.type === "header" || activeRowIndex === -1;

  // Restore focus if the active row disappears
  useLayoutEffect(() => {
    if (
      active.type === "body" &&
      activeRowIndex === -1 &&
      gridHasFocus.current
    ) {
      headerRefs.current[activeColumn]?.focus();
    }
  }, [active, activeRowIndex, activeColumn]);

  // 3. Sorting
  const handleSort = (key: keyof T, col: number) => {
    setSortConfig((previous) => ({
      key,
      direction:
        previous?.key === key &&
        previous.direction === "ascending"
          ? "descending"
          : "ascending",
    }));

    setPageIndex(0);
    setActive({ type: "header", col });
  };

  // 4. Filtering
  const handleSearch = (value: string) => {
    setSearch(value);
    setPageIndex(0);
    setActive({ type: "header", col: 0 });
  };

  // 5. Pagination
  const changePage = (page: number) => {
    if (
      page < 0 ||
      page >= totalPages ||
      page === currentPage
    ) {
      return;
    }

    setPageIndex(page);
    setActive({ type: "header", col: 0 });
  };

  // 6. Select row with Enter
  const selectRow = (item: T) => {
    if (validSelectedRows.includes(item)) return;

    setSelectedRows([...validSelectedRows, item]);
    onRowSelect?.(item);
  };

  // 7. Toggle selection with Space
  const toggleRow = (item: T) => {
    const isSelected = validSelectedRows.includes(item);

    setSelectedRows(
      isSelected
        ? validSelectedRows.filter((row) => row !== item)
        : [...validSelectedRows, item]
    );

    if (!isSelected) onRowSelect?.(item);
  };

  // 8. Focus helpers
  const focusHeader = (col: number) => {
    headerRefs.current[col]?.focus();
  };

  const focusCell = (row: number, col: number) => {
    cellRefs.current[row]?.[col]?.focus();
  };

  // 9. Header keyboard navigation
  const handleHeaderKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    col: number
  ) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusHeader(Math.min(col + 1, columns.length - 1));
        break;

      case "ArrowLeft":
        event.preventDefault();
        focusHeader(Math.max(col - 1, 0));
        break;

      case "ArrowDown":
        event.preventDefault();
        if (pageRows.length > 0) focusCell(0, col);
        break;

      case "ArrowUp":
        event.preventDefault();
        break;
    }
  };

  // 10. Body keyboard navigation
  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
    item: T
  ) => {
    if (event.target !== event.currentTarget) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusCell(
          Math.min(rowIndex + 1, pageRows.length - 1),
          colIndex
        );
        break;

      case "ArrowUp":
        event.preventDefault();

        if (rowIndex === 0) {
          focusHeader(colIndex);
        } else {
          focusCell(rowIndex - 1, colIndex);
        }
        break;

      case "ArrowRight":
        event.preventDefault();
        focusCell(
          rowIndex,
          Math.min(colIndex + 1, columns.length - 1)
        );
        break;

      case "ArrowLeft":
        event.preventDefault();
        focusCell(rowIndex, Math.max(colIndex - 1, 0));
        break;

      case "Enter":
        event.preventDefault();
        selectRow(item);
        break;

      case " ":
        event.preventDefault();
        toggleRow(item);
        break;
    }
  };

  if (columns.length === 0) {
    return <p role="status">No columns configured.</p>;
  }

  return (
    <section aria-label={ariaLabel}>
      {/* Search */}
      <div className="grid-toolbar">
        <div className="search-group">
          <label htmlFor={searchId}>Search employees</label>

          <input
            id={searchId}
            type="search"
            value={search}
            placeholder="Search employees..."
            onChange={(event) =>
              handleSearch(event.target.value)
            }
          />

          <button
            type="button"
            className="clear-button"
            disabled={!search}
            onClick={() => handleSearch("")}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Live status */}
      <p className="grid-status" role="status" aria-atomic="true">
        Showing {firstRecord}–{endIndex} of {totalRecords} records.
        {" "}
        {validSelectedRows.length} rows selected.
        {" "}
        Page {currentPage + 1} of {totalPages}.
      </p>

      {/* Instructions */}
      <p id={instructionsId} className="grid-instructions">
        Use Tab to enter or leave the grid.
        Use arrow keys to navigate headers and cells.
        Press Enter to select a row.
        Press Space to toggle row selection.
      </p>

      {/* Accessible Grid */}
      <div className="table-container">
        <table
          role="grid"
          aria-label={ariaLabel}
          aria-describedby={instructionsId}
          aria-multiselectable="true"
          onFocusCapture={() => {
            gridHasFocus.current = true;
          }}
          onBlurCapture={(event) => {
            const next = event.relatedTarget;

            if (
              !next ||
              !event.currentTarget.contains(next as Node)
            ) {
              gridHasFocus.current = false;
            }
          }}
        >
          <thead>
            <tr role="row">
              {columns.map((column, colIndex) => {
                const isSorted =
                  sortConfig?.key === column.accessorKey;

                const isActiveHeader =
                  headerIsActive &&
                  activeColumn === colIndex;

                return (
                  <th
                    key={String(column.accessorKey)}
                    scope="col"
                    role="columnheader"
                    aria-sort={
                      column.sortable && isSorted
                        ? sortConfig.direction
                        : undefined
                    }
                    tabIndex={
                      column.sortable
                        ? undefined
                        : isActiveHeader
                          ? 0
                          : -1
                    }
                    ref={
                      column.sortable
                        ? undefined
                        : (element) => {
                            headerRefs.current[colIndex] = element;
                          }
                    }
                    onFocus={
                      column.sortable
                        ? undefined
                        : () =>
                            setActive({
                              type: "header",
                              col: colIndex,
                            })
                    }
                    onKeyDown={
                      column.sortable
                        ? undefined
                        : (event) =>
                            handleHeaderKeyDown(event, colIndex)
                    }
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="sort-button"
                        tabIndex={isActiveHeader ? 0 : -1}
                        ref={(element) => {
                          headerRefs.current[colIndex] = element;
                        }}
                        onFocus={() =>
                          setActive({
                            type: "header",
                            col: colIndex,
                          })
                        }
                        onKeyDown={(event) =>
                          handleHeaderKeyDown(event, colIndex)
                        }
                        onClick={() =>
                          handleSort(column.accessorKey, colIndex)
                        }
                        aria-label={
                          isSorted
                            ? `${column.header}, sorted ${
                                sortConfig.direction
                              }. Activate to sort ${
                                sortConfig.direction === "ascending"
                                  ? "descending"
                                  : "ascending"
                              }.`
                            : `${column.header}, sort ascending`
                        }
                      >
                        {column.header}
                        <span aria-hidden="true">
                          {isSorted
                            ? sortConfig.direction === "ascending"
                              ? " ↑"
                              : " ↓"
                            : " ↕"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr role="row">
                <td
                  role="gridcell"
                  colSpan={columns.length}
                  className="empty-state"
                >
                  No matching results found.
                  Try a different search term.
                </td>
              </tr>
            ) : (
              pageRows.map(
                ({ item, index: originalIndex }, rowIndex) => {
                  const isSelected =
                    validSelectedRows.includes(item);

                  return (
                    <tr
                      key={originalIndex}
                      role="row"
                      aria-selected={isSelected}
                    >
                      {columns.map((column, colIndex) => (
                        <td
                          key={String(column.accessorKey)}
                          role="gridcell"
                          tabIndex={
                            !headerIsActive &&
                            activeRowIndex === rowIndex &&
                            activeColumn === colIndex
                              ? 0
                              : -1
                          }
                          ref={(element) => {
                            if (!cellRefs.current[rowIndex]) {
                              cellRefs.current[rowIndex] = [];
                            }

                            cellRefs.current[rowIndex][colIndex] =
                              element;
                          }}
                          onFocus={() =>
                            setActive({
                              type: "body",
                              item,
                              col: colIndex,
                            })
                          }
                          onKeyDown={(event) =>
                            handleCellKeyDown(
                              event,
                              rowIndex,
                              colIndex,
                              item
                            )
                          }
                          onClick={(event) => {
                            event.currentTarget.focus();
                            selectRow(item);
                          }}
                        >
                          {String(
                            item[column.accessorKey] ?? "—"
                          )}

                          {colIndex === 0 && isSelected && (
                            <span className="selected-label">
                              {" "}✓ Selected
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                }
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav className="pagination" aria-label="Grid pagination">
        <button
          type="button"
          className="pagination-button"
          aria-disabled={currentPage === 0}
          onClick={() => changePage(currentPage - 1)}
        >
          ← Previous
        </button>

        <div className="page-numbers">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              type="button"
              className="pagination-button"
              aria-label={`Go to page ${index + 1}`}
              aria-current={
                currentPage === index ? "page" : undefined
              }
              onClick={() => changePage(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pagination-button"
          aria-disabled={currentPage === totalPages - 1}
          onClick={() => changePage(currentPage + 1)}
        >
          Next →
        </button>
      </nav>
    </section>
  );
}
