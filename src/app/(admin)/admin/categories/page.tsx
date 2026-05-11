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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Plus, Search, Trash2, FolderTree, ArrowRight } from "lucide-react";
import { flexRender, ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoryListPage() {
  const { edit, create } = useNavigation();
  const { mutate: deleteRecord } = useDelete();

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      id: "category",
      header: "Category",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-6 py-4">
          <div className="w-16 h-16 bg-black/5 rounded-[2rem] flex items-center justify-center border border-black/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
             <FolderTree size={24} className="opacity-20" />
          </div>
          <div>
            <div className="font-black tracking-tighter text-lg uppercase">{row.original.name}</div>
            <div className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em] mt-1">slug: {row.original.slug}</div>
          </div>
        </div>
      ),
    },
    {
      id: "description",
      header: "Description",
      accessorKey: "description",
      cell: ({ getValue }) => (
        <span className="text-sm font-medium opacity-60 line-clamp-1 max-w-md">{getValue() as string || "No narrative defined."}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-black/5 text-blue-600" onClick={() => edit("categories", row.original.id)}>
            <Edit2 size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-red-50 text-red-600" onClick={() => {
            if (confirm("Delete this hierarchy?")) {
              deleteRecord({ resource: "categories", id: row.original.id });
            }
          }}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ], [edit, deleteRecord]);

  const {
    reactTable,
    refineCore,
  } = useTable({
    refineCoreProps: { resource: "categories" },
    columns,
  }) as any;

  const { getHeaderGroups, getRowModel } = reactTable;
  const isLoading = refineCore?.tableQueryResult?.isLoading;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Hierarchies</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Organize your commerce architecture</p>
        </div>
        <Button onClick={() => create("categories")} className="rounded-full h-16 px-12 bg-[#121212] text-[#FDFCF8] font-black text-xs uppercase tracking-widest gap-4 shadow-2xl hover:scale-105 transition-transform duration-500">
          <Plus size={20} />
          New Category
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 bg-white p-5 rounded-[2.5rem] border border-black/5 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <Input className="pl-16 border-none bg-transparent shadow-none focus-visible:ring-0 h-14 text-sm font-bold" placeholder="Search hierarchies..." />
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
              Array.from({ length: 3 }).map((_, i) => (
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
