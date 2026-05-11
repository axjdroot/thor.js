"use client";

import { useBreadcrumb } from "@refinedev/core";
import { Bell, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import { useState, useEffect } from "react";

export const AdminHeader = () => {
  const { breadcrumbs } = useBreadcrumb();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="h-20 bg-[#FDFCF8] border-b border-black/5 flex items-center justify-between px-10 shrink-0">
        <div className="w-48 h-4 bg-black/5 rounded-full" />
        <div className="flex items-center gap-8">
          <div className="w-40 h-10 bg-black/5 rounded-full" />
          <div className="w-20 h-10 bg-black/5 rounded-full" />
        </div>
      </header>
    );
  }

  return (
    <header className="h-20 bg-[#FDFCF8] border-b border-black/5 flex items-center justify-between px-10 shrink-0">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#121212]/40">
        {breadcrumbs.map((breadcrumb: any, i: number) => (
          <div key={breadcrumb.label} className="flex items-center gap-3">
            {i > 0 && <span className="opacity-20">/</span>}
            {breadcrumb.href ? (
              <Link href={breadcrumb.href} className="hover:text-[#121212] transition-colors">{breadcrumb.label}</Link>
            ) : (
              <span className="text-[#121212]">{breadcrumb.label}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-8">
        <button className="hidden md:flex items-center gap-4 px-6 py-2.5 bg-[#121212]/5 rounded-full text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all border border-transparent hover:border-black/5">
          <Search size={14} />
          <span>Quick Search</span>
          <span className="opacity-40 ml-4 font-mono">⌘K</span>
        </button>

        <div className="flex items-center gap-4 border-l border-black/5 pl-8">
          <NotificationBell />

          <div className="flex items-center gap-1 p-1 bg-black/5 rounded-full">
            <button 
              onClick={() => setTheme("light")} 
              className={cn("p-2 rounded-full transition-all", theme === "light" ? "bg-white shadow-sm text-[#121212]" : "text-[#121212]/40 hover:text-[#121212]")}
            >
              <Sun size={14} />
            </button>
            <button 
              onClick={() => setTheme("dark")} 
              className={cn("p-2 rounded-full transition-all", theme === "dark" ? "bg-white shadow-sm text-[#121212]" : "text-[#121212]/40 hover:text-[#121212]")}
            >
              <Moon size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
