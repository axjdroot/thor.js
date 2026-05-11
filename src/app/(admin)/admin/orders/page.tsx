"use client";

import { useTable } from "@refinedev/react-table";
import { useNavigation } from "@refinedev/core";
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
import { Eye, Search, ShoppingCart, Filter, ArrowRight } from "lucide-react";
import { flexRender, ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function OrderListPage() {
  const { show } = useNavigation();

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      id: "order",
      header: "Order ID",
      accessorKey: "orderNumber",
      cell: ({ row }) => (
        <div className="flex items-center gap-5 py-4">
          <div className="w-14 h-14 bg-black/5 rounded-3xl flex items-center justify-center border border-black/5 group-hover:scale-110 transition-transform duration-500">
             <ShoppingCart size={18} className="opacity-30" />
          </div>
          <div>
            <div className="font-black tracking-tighter text-base uppercase">#{row.original.orderNumber || row.original.id.substring(0, 8)}</div>
            <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mt-1.5">
              {row.original.createdAt ? format(new Date(row.original.createdAt), "MMM d, h:mm a") : "Processing"}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      accessorKey: "customer.email",
      cell: ({ row }) => (
        <div className="flex flex-col">
           <span className="font-bold text-sm tracking-tight">{row.original.customer?.name || "Guest Checkout"}</span>
           <span className="text-[10px] font-black opacity-30 uppercase tracking-widest mt-0.5">{row.original.customer?.email}</span>
        </div>
      ),
    },
    {
      id: "payment",
      header: "Payment",
      accessorKey: "paymentStatus",
      cell: ({ getValue }) => {
        const status = (getValue() as string) || "pending";
        return (
          <Badge variant={status === "paid" ? "success" : "warning"} className="uppercase text-[9px] font-black tracking-[0.2em] px-4 py-1.5 rounded-full">
            {status}
          </Badge>
        );
      },
    },
    {
      id: "fulfillment",
      header: "Fulfillment",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const status = (getValue() as string) || "pending";
        const variants: Record<string, any> = {
          pending: "warning",
          processing: "info",
          shipped: "secondary",
          delivered: "success",
          cancelled: "destructive",
        };
        return (
          <Badge variant={variants[status] || "outline"} className="uppercase text-[9px] font-black tracking-[0.2em] px-4 py-1.5 rounded-full">
            {status}
          </Badge>
        );
      },
    },
    {
      id: "total",
      header: "Total",
      accessorKey: "totalAmount",
      cell: ({ getValue }) => (
        <span className="font-black text-lg tracking-tighter">${(getValue() as number || 0).toLocaleString()}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end pr-4">
          <Button 
            variant="ghost" 
            className="rounded-full h-12 w-12 bg-black/5 hover:bg-[#121212] hover:text-[#FDFCF8] transition-all group/btn" 
            onClick={() => show("orders", row.original.id)}
          >
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      ),
    },
  ], [show]);

  const {
    reactTable,
    refineCore,
  } = useTable({
    refineCoreProps: { resource: "orders" },
    columns,
  }) as any;

  const { getHeaderGroups, getRowModel } = reactTable;
  const isLoading = refineCore?.tableQueryResult?.isLoading;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Commerce</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Processing lifecycle and fulfillment</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 bg-white p-5 rounded-[2.5rem] border border-black/5 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <Input className="pl-16 border-none bg-transparent shadow-none focus-visible:ring-0 h-14 text-sm font-bold" placeholder="Search orders by ID, email, or tracking..." />
        </div>
        <div className="h-10 w-px bg-black/5 mx-2" />
        <Button variant="ghost" className="rounded-full px-10 h-14 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5 gap-3">
          <Filter size={14} />
          Refine
        </Button>
        <Button variant="ghost" className="rounded-full px-10 h-14 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5">Export CSV</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[4rem] border border-black/5 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-black/[0.02]">
            {getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header: any) => (
                  <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-[0.2em] h-24 px-10">
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
                  <TableCell colSpan={columns.length} className="px-10 py-10">
                    <Skeleton className="h-16 w-full rounded-[2rem]" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              getRowModel().rows.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-black/[0.01] border-black/[0.03] group transition-colors">
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="px-10 py-2">
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
