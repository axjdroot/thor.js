"use client";

import { useTable } from "@refinedev/react-table";
import { useNavigation, useDelete } from "@refinedev/core";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Eye, Plus, Search, Trash2, Package } from "lucide-react";
import { flexRender, ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ProductListPage() {
  const { edit, create, show } = useNavigation();
  const { mutate: deleteRecord } = useDelete();

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      id: "product",
      header: "Product",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-4 py-2">
          <div className="w-14 h-14 bg-black/5 rounded-2xl flex items-center justify-center overflow-hidden border border-black/5 group-hover:scale-105 transition-transform duration-500">
            {row.original.images?.[0]?.url ? (
              <img src={row.original.images[0].url} alt="" className="object-cover w-full h-full" />
            ) : (
              <Package size={16} className="opacity-20" />
            )}
          </div>
          <div>
            <div className="font-bold tracking-tight text-sm">{row.original.name}</div>
            <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] mt-0.5">{row.original.sku || 'NO-SKU'}</div>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category.name",
      cell: ({ getValue }) => (
        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{getValue() as string || "Uncategorized"}</span>
      ),
    },
    {
      id: "inventory",
      header: "Inventory",
      accessorKey: "stock",
      cell: ({ row }) => {
        const stock = row.original.stock || 0;
        return (
          <div className="flex flex-col gap-1.5">
             <div className="text-[10px] font-black uppercase tracking-widest">{stock} in stock</div>
             <div className="h-1 w-20 bg-black/5 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", stock < 10 ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min(stock, 100)}%` }} />
             </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <Badge variant={status === "active" ? "success" : "secondary"} className="uppercase text-[9px] font-black tracking-widest px-4 py-1">
            {status}
          </Badge>
        );
      },
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ getValue }) => (
        <span className="font-black text-sm tracking-tight">${(getValue() as number)?.toLocaleString()}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-black/5" onClick={() => show("products", row.original.id)}>
            <Eye size={14} className="opacity-40" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-black/5 text-blue-600" onClick={() => edit("products", row.original.id)}>
            <Edit2 size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-red-50 text-red-600" onClick={() => {
            if (confirm("Delete this product?")) {
              deleteRecord({ resource: "products", id: row.original.id });
            }
          }}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ], [edit, show, deleteRecord]);

  const {
    reactTable,
    refineCore,
  } = useTable({
    refineCoreProps: { resource: "products" },
    columns,
  }) as any;

  const { getHeaderGroups, getRowModel } = reactTable;
  const isLoading = refineCore?.tableQueryResult?.isLoading;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Catalogue</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Manage your product inventory</p>
        </div>
        <Button onClick={() => create("products")} className="rounded-full h-16 px-12 bg-[#121212] text-[#FDFCF8] font-black text-xs uppercase tracking-widest gap-4 shadow-2xl hover:scale-105 transition-transform duration-500">
          <Plus size={20} />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 bg-white p-5 rounded-[2.5rem] border border-black/5 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <Input className="pl-16 border-none bg-transparent shadow-none focus-visible:ring-0 h-14 text-sm font-bold" placeholder="Search products by name or SKU..." />
        </div>
        <div className="h-10 w-px bg-black/5 mx-2" />
        <Button variant="ghost" className="rounded-full px-10 h-14 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5">Filter</Button>
        <Button variant="ghost" className="rounded-full px-10 h-14 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5">Export</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[3.5rem] border border-black/5 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-black/[0.02]">
            {getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header: any) => (
                  <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-[0.2em] h-20 px-10">
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
                  <TableCell colSpan={columns.length} className="px-10 py-8">
                    <Skeleton className="h-14 w-full rounded-[1.5rem]" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              getRowModel().rows.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-black/[0.01] border-black/[0.03] group transition-colors">
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="px-10 py-3">
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
