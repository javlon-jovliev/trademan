"use client";
/* eslint-disable react-hooks/incompatible-library -- TanStack Table is intentionally not React Compiler memoized. */
import { ValueHelp } from "./ValueHelp";
import type { T } from "./Platform";
import { useState, Fragment } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
type TLabel = T;
export function DataTable<T>({
  data,
  columns,
  onRow,
  expanded,
  t,
}: {
  t: TLabel;
  data: T[];
  columns: ColumnDef<T>[];
  onRow?: (row: T) => void;
  expanded?: (row: T) => React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });
  return (
    <>
      <div
        className="table-scroll"
        role="region"
        aria-label={t("tableHint")}
        tabIndex={0}
      >
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    aria-sort={
                      h.column.getIsSorted() === "asc"
                        ? "ascending"
                        : h.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <ValueHelp
                      definition={
                        h.column.id === "heat" ? "riskTab" : undefined
                      }
                      label={
                        typeof h.column.columnDef.header === "string"
                          ? h.column.columnDef.header
                          : undefined
                      }
                      icon
                    >
                      {h.column.getCanSort() ? (
                        <button onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {h.column.getIsSorted() === "asc"
                            ? " ↑"
                            : h.column.getIsSorted() === "desc"
                              ? " ↓"
                              : ""}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </ValueHelp>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  tabIndex={onRow ? 0 : undefined}
                  onClick={() => onRow?.(r.original)}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      onRow?.(r.original);
                    }
                  }}
                >
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id}>
                      <ValueHelp
                        definition={
                          c.column.id === "heat" ? "riskTab" : undefined
                        }
                        label={
                          typeof c.column.columnDef.header === "string"
                            ? c.column.columnDef.header
                            : undefined
                        }
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </ValueHelp>
                    </td>
                  ))}
                </tr>
                {expanded?.(r.original) && (
                  <tr>
                    <td colSpan={columns.length} className="expanded">
                      {expanded(r.original)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="pagination">
          <button
            aria-label={t("previousPage")}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ‹
          </button>
          <span>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            aria-label={t("nextPage")}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
