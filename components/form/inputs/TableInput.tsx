"use client";

import { cn } from "@/lib/utils";
import type { TableColumn, TableRow, TableValue } from "@/lib/schema";

type Cell = string | number | "n/a" | undefined;

export function TableInput({
  rows,
  columns,
  value,
  onChange,
}: {
  rows: TableRow[];
  columns: TableColumn[];
  value: TableValue | undefined;
  onChange: (v: TableValue) => void;
}) {
  const data = value ?? {};

  const setCell = (rowId: string, colId: string, cell: Cell) => {
    const next: TableValue = { ...data, [rowId]: { ...data[rowId] } };
    if (cell === undefined || cell === "") {
      delete next[rowId][colId];
      if (Object.keys(next[rowId]).length === 0) delete next[rowId];
    } else {
      next[rowId] = { ...next[rowId], [colId]: cell };
    }
    onChange(next);
  };

  return (
    <>
      {/* Desktop / tablet: classic table. */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-white sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/40">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                {/* row-label corner */}
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={cn(
                  rowIndex !== rows.length - 1 && "border-b border-line/60"
                )}
              >
                <td className="whitespace-nowrap px-3 py-1.5 text-sm text-ink">
                  {row.label}
                </td>
                {columns.map((col) => {
                  const v = data[row.id]?.[col.id];
                  const isNumber = (col.type ?? "number") === "number";
                  return (
                    <td key={col.id} className="px-2 py-1">
                      <input
                        type={isNumber ? "number" : "text"}
                        inputMode={isNumber ? "decimal" : undefined}
                        value={v === undefined ? "" : String(v)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setCell(row.id, col.id, undefined);
                            return;
                          }
                          if (isNumber) {
                            const n = Number(raw);
                            setCell(
                              row.id,
                              col.id,
                              Number.isNaN(n) ? undefined : n
                            );
                          } else {
                            setCell(row.id, col.id, raw);
                          }
                        }}
                        className="h-9 w-full min-w-[6rem] rounded-control border border-transparent bg-canvas/30 px-2 outline-none transition-shadow focus-visible:border-accent focus-visible:bg-white focus-visible:shadow-focus"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Mobile (< sm): the same table fillable one row at a time. Each row
        becomes a small card with the row label as the heading and each column
        as a labelled input below. Penny's 2026-05-11 feedback: the kWh table
        was the single worst experience on a phone.
      */}
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-card border border-line bg-white p-3"
          >
            <p className="text-sm font-medium text-ink">{row.label}</p>
            <div className="mt-2 space-y-2">
              {columns.map((col) => {
                const v = data[row.id]?.[col.id];
                const isNumber = (col.type ?? "number") === "number";
                return (
                  <label
                    key={col.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-xs text-muted">{col.label}</span>
                    <input
                      type={isNumber ? "number" : "text"}
                      inputMode={isNumber ? "decimal" : undefined}
                      value={v === undefined ? "" : String(v)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setCell(row.id, col.id, undefined);
                          return;
                        }
                        if (isNumber) {
                          const n = Number(raw);
                          setCell(
                            row.id,
                            col.id,
                            Number.isNaN(n) ? undefined : n
                          );
                        } else {
                          setCell(row.id, col.id, raw);
                        }
                      }}
                      className="h-10 w-36 rounded-control border border-line bg-white px-3 text-sm outline-none transition-shadow focus-visible:border-accent focus-visible:shadow-focus"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
