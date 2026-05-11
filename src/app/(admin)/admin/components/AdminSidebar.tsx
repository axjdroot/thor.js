"use client";

import { useMenu, useLogout, useGetIdentity } from "@refinedev/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  FolderTree,
  Boxes,
  Settings,
  Bell
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const AdminSidebar = () => {
  const { menuItems, selectedKey } = useMenu();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ name: string; avatar: string; email: string }>();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={cn(
      "h-screen bg-[#121212] text-[#FDFCF8] flex flex-col transition-all duration-300 z-50",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Header */}
      <div className="h-20 flex items-center px-6 border-b border-white/5 justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FDFCF8] rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-[#121212] rotate-45" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">Thor</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 py-8">
        {menuItems.map((item: any) => {
          const isActive = selectedKey === item.key || pathname.startsWith(item.route || "");
          return (
            <Link
              key={item.key}
              href={item.route || "/"}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all group",
                isActive 
                  ? "bg-[#FDFCF8] text-[#121212] shadow-[0_0_20px_rgba(253,252,248,0.2)]" 
                  : "hover:bg-white/5 text-white/40 hover:text-white"
              )}
            >
              <div className={cn("transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")}>
                {item.icon}
              </div>
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className={cn("flex items-center gap-4 px-2 py-3 rounded-2xl", !collapsed && "hover:bg-white/5 transition-colors")}>
           <Avatar className="h-10 w-10 border border-white/10 flex-shrink-0">
              <AvatarImage src={identity?.avatar} />
              <AvatarFallback className="bg-white/10 text-[#FDFCF8] text-xs font-bold">
                {identity?.name?.substring(0, 2).toUpperCase() || 'AD'}
              </AvatarFallback>
           </Avatar>
           {!collapsed && (
             <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight">{identity?.name}</p>
                <p className="text-[10px] text-white/30 truncate uppercase tracking-widest font-bold mt-0.5">{identity?.email}</p>
             </div>
           )}
        </div>
        
        <button 
          onClick={() => logout()}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-400/10 transition-all mt-4",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
