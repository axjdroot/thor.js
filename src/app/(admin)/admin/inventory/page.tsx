"use client";

import { useTable } from "@refinedev/react-table";
import { useUpdate } from "@refinedev/core";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, Package, RefreshCw, AlertTriangle } from "lucide-react";
import { flexRender, ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const { mutate: updateStock } = useUpdate();
  const [adjustingId, setAdjustingId] = React.useState<string | null>(null);
  const [newStock, setNewStock] = React.useState<number>(0);

  const handleAdjust = (id: string, current: number) => {
    setAdjustingId(id);
    setNewStock(current);
  };

  const saveAdjust = (id: string) => {
    updateStock({
      resource: "inventory",
      id,
      values: { stock: newStock },
    });
    setAdjustingId(null);
  };

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      id: "item",
      header: "Commercial Item",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-6 py-5">
           <div className="w-16 h-16 bg-black/5 rounded-[1.75rem] flex items-center justify-center border border-black/5 group-hover:rotate-3 transition-transform duration-500">
              <Package size={24} className="opacity-20" />
           </div>
           <div>
              <div className="font-black text-base tracking-tight">{row.original.name}</div>
              <div className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em] mt-1.5">{row.original.sku || "UNASSIGNED"}</div>
           </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "stock",
      cell: ({ getValue }) => {
        const stock = (getValue() as number) || 0;
        if (stock === 0) return <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest bg-red-50 px-4 py-2 rounded-full w-fit"><AlertTriangle size={12} /> Out of Stock</div>;
        if (stock < 10) return <div className="flex items-center gap-2 text-orange-600 font-black text-[10px] uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-full w-fit"><AlertTriangle size={12} /> Low Stock</div>;
        return <div className="flex items-center gap-2 text-green-600 font-black text-[10px] uppercase tracking-widest bg-green-50 px-4 py-2 rounded-full w-fit">Optimal</div>;
      }
    },
    {
      id: "quantity",
      header: "In Stock",
      accessorKey: "stock",
      cell: ({ row, getValue }) => {
        const id = row.original.id;
        const stock = (getValue() as number) || 0;
        
        if (adjustingId === id) {
          return (
            <div className="flex items-center gap-3">
              <Input 
                type="number" 
                value={newStock} 
                onChange={(e) => setNewStock(parseInt(e.target.value))}
                className="w-24 h-12 bg-black/5 border-none font-black text-center text-base rounded-xl"
              />
              <Button size="sm" onClick={() => saveAdjust(id)} className="bg-[#121212] text-[#FDFCF8] rounded-xl h-12 px-6 font-black text-[10px] uppercase tracking-widest">Update</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdjustingId(null)} className="h-12 w-12 rounded-full p-0">×</Button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-8">
            <span className="font-black text-2xl tracking-tighter w-12">{stock}</span>
            <Button 
              variant="ghost" 
              onClick={() => handleAdjust(id, stock)}
              className="rounded-full h-12 px-6 bg-black/5 text-[10px] font-black uppercase tracking-widest hover:bg-[#121212] hover:text-[#FDFCF8] transition-all gap-3"
            >
              <RefreshCw size={14} />
              Adjust
            </Button>
          </div>
        );
      }
    },
  ], [adjustingId, newStock, updateStock]);

  const {
    reactTable,
    refineCore,
  } = useTable({
    refineCoreProps: { resource: "inventory" },
    columns,
  }) as any;

  const { getHeaderGroups, getRowModel } = reactTable;
  const isLoading = refineCore?.tableQueryResult?.isLoading;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Operations</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Atomic stock management and reserves</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[4rem] border border-black/5 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-black/[0.02]">
            {getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header: any) => (
                  <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-[0.2em] h-24 px-12">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-black/[0.03]">
                  <TableCell colSpan={columns.length} className="px-12 py-10">
                    <Skeleton className="h-16 w-full rounded-[2rem]" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              getRowModel().rows.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-black/[0.01] border-black/[0.03] group transition-colors">
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="px-12 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
