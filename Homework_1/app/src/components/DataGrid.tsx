
import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { DataGridProps } from "./data-grid-contract";

const PAGE_SIZE = 10;

export default function DataGrid<T>({
  data,
  columns,
  ariaLabel,
  onRowSelect,
}: DataGridProps<T>) {
  const instructionsId = useId();
  const searchId = useId();

  // Search state
  const [search, setSearch] = useState("");

  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);

  // Keyboard navigation
  const [active, setActive] = useState({
    row: 0,
    col: 0,
  });

  // Row selection
  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  // Cell references
  const cellRefs = useRef<(HTMLTableCellElement | null)[][]>([]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "ascending" | "descending";
  } | null>(null);

  // Handle sorting
  const handleSort = (key: keyof T) => {
    setSortConfig((previous) => ({
      key,
      direction:
        previous?.key === key &&
        previous.direction === "ascending"
          ? "descending"
          : "ascending",
    }));

    setPageIndex(0);
    setActive({ row: 0, col: 0 });
  };

  // Filter and sort
  const processedRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const rows = data
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!query) return true;

        return columns.some((column) =>
          String(item[column.accessorKey] ?? "")
            .toLocaleLowerCase()
            .includes(query)
        );
      });

    if (!sortConfig) return rows;

    return [...rows].sort((a, b) => {
      const aValue = a.item[sortConfig.key];
      const bValue = b.item[sortConfig.key];

      if (aValue == null && bValue == null) {
        return a.index - b.index;
      }

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      let result: number;

      if (
        typeof aValue === "number" &&
        typeof bValue === "number"
      ) {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(
          String(bValue),
          "en",
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      if (result === 0) {
        return a.index - b.index;
      }

      return sortConfig.direction === "ascending"
        ? result
        : -result;
    });
  }, [data, columns, search, sortConfig]);

  // Pagination calculations
  const totalRecords = processedRows.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalRecords / PAGE_SIZE)
  );

  const currentPage = Math.min(
    pageIndex,
    totalPages - 1
  );

  const startIndex = currentPage * PAGE_SIZE;

  const endIndex = Math.min(
    startIndex + PAGE_SIZE,
    totalRecords
  );

  const paginatedRows = processedRows.slice(
    startIndex,
    endIndex
  );

  const firstRecord =
    totalRecords === 0 ? 0 : startIndex + 1;

  // Change page
  const changePage = (newPage: number) => {
    if (
      newPage < 0 ||
      newPage >= totalPages ||
      newPage === currentPage
    ) {
      return;
    }

    setPageIndex(newPage);
    setActive({ row: 0, col: 0 });
  };

  // Handle filtering
  const handleSearch = (value: string) => {
    setSearch(value);
    setPageIndex(0);
    setActive({ row: 0, col: 0 });
  };

  // Select row
  const selectRow = (item: T) => {
    if (selectedRows.includes(item)) return;

    setSelectedRows((previous) => [...previous, item]);
    onRowSelect?.(item);
  };

  // Toggle row selection
  const toggleRow = (item: T) => {
    const isSelected = selectedRows.includes(item);

    setSelectedRows((previous) =>
      isSelected
        ? previous.filter((row) => row !== item)
        : [...previous, item]
    );

    if (!isSelected) {
      onRowSelect?.(item);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (
    event: KeyboardEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
    item: T
  ) => {
    if (event.target !== event.currentTarget) return;

    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (event.key) {
      case "ArrowDown":
        nextRow = Math.min(
          rowIndex + 1,
          paginatedRows.length - 1
        );
        break;

      case "ArrowUp":
        nextRow = Math.max(rowIndex - 1, 0);
        break;

      case "ArrowRight":
        nextCol = Math.min(
          colIndex + 1,
          columns.length - 1
        );
        break;

      case "ArrowLeft":
        nextCol = Math.max(colIndex - 1, 0);
        break;

      case "Enter":
        event.preventDefault();
        selectRow(item);
        return;

      case " ":
        event.preventDefault();
        toggleRow(item);
        return;

      default:
        return;
    }

    event.preventDefault();

    setActive({
      row: nextRow,
      col: nextCol,
    });

    cellRefs.current[nextRow]?.[nextCol]?.focus();
  };

  // Empty columns
  if (columns.length === 0) {
    return <p role="status">No columns configured.</p>;
  }

  const activeRow = Math.min(
    active.row,
    Math.max(0, paginatedRows.length - 1)
  );

  const activeCol = Math.min(
    active.col,
    columns.length - 1
  );

  return (
    <section aria-label={ariaLabel}>
      {/* Search toolbar */}
      <div className="grid-toolbar">
        <div className="search-group">
          <label htmlFor={searchId}>
            Search employees
          </label>

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
            onClick={() => handleSearch("")}
            disabled={search.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grid status */}
      <p className="grid-status" role="status">
        Showing {firstRecord}–{endIndex} of{" "}
        {totalRecords} records.
        {" "}
        {selectedRows.length} rows selected.
        {" "}
        Page {currentPage + 1} of {totalPages}.
      </p>

      {/* Keyboard instructions */}
      <p
        id={instructionsId}
        className="grid-instructions"
      >
        Use arrow keys to navigate cells.
        Press Enter to select a row.
        Press Space to toggle row selection.
      </p>

      {/* Data Grid */}
      <div className="table-container">
        <table
          role="grid"
          aria-label={ariaLabel}
          aria-describedby={instructionsId}
          aria-multiselectable="true"
        >
          <thead>
            <tr role="row">
              {columns.map((column) => (
                <th
                  key={String(column.accessorKey)}
                  role="columnheader"
                  scope="col"
                  aria-sort={
                    column.sortable &&
                    sortConfig?.key === column.accessorKey
                      ? sortConfig.direction
                      : undefined
                  }
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() =>
                        handleSort(column.accessorKey)
                      }
                      aria-label={
                        `Sort by ${column.header}` +
                        (sortConfig?.key ===
                        column.accessorKey
                          ? `, currently sorted ${sortConfig.direction}`
                          : "")
                      }
                    >
                      {column.header}

                      <span aria-hidden="true">
                        {sortConfig?.key ===
                        column.accessorKey
                          ? sortConfig.direction ===
                            "ascending"
                            ? " ↑"
                            : " ↓"
                          : " ↕"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.length === 0 ? (
              <tr role="row">
                <td
                  role="gridcell"
                  colSpan={columns.length}
                  tabIndex={0}
                  className="empty-state"
                >
                  No matching results found.
                  Try a different search term.
                </td>
              </tr>
            ) : (
              paginatedRows.map(
                ({ item: row, index: originalIndex }, rowIndex) => {
                  const isSelected =
                    selectedRows.includes(row);

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
                            activeRow === rowIndex &&
                            activeCol === colIndex
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
                              row: rowIndex,
                              col: colIndex,
                            })
                          }
                          onKeyDown={(event) =>
                            handleKeyDown(
                              event,
                              rowIndex,
                              colIndex,
                              row
                            )
                          }
                          onClick={(event) => {
                            event.currentTarget.focus();
                            selectRow(row);
                          }}
                        >
                          {String(
                            row[column.accessorKey] ?? "—"
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

      {/* Pagination controls */}
      <nav
        className="pagination"
        aria-label="Grid pagination"
      >
        <button
          type="button"
          className="pagination-button"
          aria-disabled={currentPage === 0}
          onClick={() => changePage(currentPage - 1)}
        >
          ← Previous
        </button>

        <div className="page-numbers">
          {Array.from(
            { length: totalPages },
            (_, index) => (
              <button
                key={index}
                type="button"
                className="pagination-button"
                aria-label={`Go to page ${index + 1}`}
                aria-current={
                  currentPage === index
                    ? "page"
                    : undefined
                }
                onClick={() => changePage(index)}
              >
                {index + 1}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="pagination-button"
          aria-disabled={
            currentPage === totalPages - 1
          }
          onClick={() => changePage(currentPage + 1)}
        >
          Next →
        </button>
      </nav>
    </section>
  );
}
