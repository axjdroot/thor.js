"use client";

import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router/app";
import { useAuth, useClerk, useSession, useUser } from "@clerk/nextjs";
import { createDataProvider } from "./lib/data-provider";
import { createAuthProvider } from "./lib/auth-provider";
import { AdminSidebar } from "./components/AdminSidebar";
import { AdminHeader } from "./components/AdminHeader";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Tag, 
  FolderTree, 
  Boxes, 
  Settings 
} from "lucide-react";
import * as React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const clerk = useClerk();
  const { session } = useSession();
  const { user } = useUser();

  const dataProvider = createDataProvider(getToken);
  const authProvider = createAuthProvider(clerk, session, user);

  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={[
          {
            name: "dashboard",
            list: "/admin/dashboard",
            meta: { label: "Dashboard", icon: <LayoutDashboard size={18} /> },
          },
          {
            name: "products",
            list: "/admin/products",
            create: "/admin/products/new",
            edit: "/admin/products/:id/edit",
            show: "/admin/products/:id",
            meta: { label: "Products", icon: <Package size={18} /> },
          },
          {
            name: "orders",
            list: "/admin/orders",
            show: "/admin/orders/:id",
            meta: { label: "Orders", icon: <ShoppingCart size={18} /> },
          },
          {
            name: "customers",
            list: "/admin/customers",
            show: "/admin/customers/:id",
            meta: { label: "Customers", icon: <Users size={18} /> },
          },
          {
            name: "discounts",
            list: "/admin/discounts",
            create: "/admin/discounts/new",
            edit: "/admin/discounts/:id/edit",
            meta: { label: "Discounts", icon: <Tag size={18} /> },
          },
          {
            name: "categories",
            list: "/admin/categories",
            create: "/admin/categories/new",
            edit: "/admin/categories/:id/edit",
            meta: { label: "Categories", icon: <FolderTree size={18} /> },
          },
          {
            name: "inventory",
            list: "/admin/inventory",
            meta: { label: "Inventory", icon: <Boxes size={18} /> },
          },
          {
            name: "settings",
            meta: { label: "Settings", icon: <Settings size={18} /> },
          },
          {
            name: "settings/store",
            list: "/admin/settings/store",
            meta: { label: "Store", parent: "settings" },
          },
          {
            name: "settings/team",
            list: "/admin/settings/team",
            meta: { label: "Team", parent: "settings" },
          },
          {
            name: "settings/taxes",
            list: "/admin/settings/taxes",
            meta: { label: "Taxes", parent: "settings" },
          },
          {
            name: "settings/shipping",
            list: "/admin/settings/shipping",
            meta: { label: "Shipping", parent: "settings" },
          },
        ]}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
        }}
      >
        <div className="flex h-screen overflow-hidden bg-[#FDFCF8] text-[#121212]">
          <AdminSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <AdminHeader />
            <main className="flex-1 overflow-y-auto p-10 bg-black/[0.01]">
              {children}
            </main>
          </div>
        </div>
      </Refine>
    </React.Suspense>
  );
}
