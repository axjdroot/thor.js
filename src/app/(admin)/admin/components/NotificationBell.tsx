"use client";

import { useList, useUpdate, useNotification } from "@refinedev/core";
import { 
  Bell, 
  ShoppingCart, 
  AlertTriangle, 
  AlertOctagon, 
  RefreshCw, 
  UserPlus, 
  Truck, 
  ArrowRight,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const NotificationBell = () => {
  const { data: notifications } = useList({
    resource: "notifications",
    pagination: { pageSize: 20 },
    queryOptions: { 
      refetchInterval: 30000,
    },
  }) as any;

  const { mutate: markAllRead } = useUpdate();
  const { open } = useNotification();

  const unreadCount = (notifications as any)?.meta?.unreadCount || 0;

  const getIcon = (type: string) => {
    switch (type) {
      case "order.created": return <ShoppingCart size={14} className="text-blue-600" />;
      case "inventory.low_stock": return <AlertTriangle size={14} className="text-yellow-600" />;
      case "inventory.out_of_stock": return <AlertOctagon size={14} className="text-red-600" />;
      case "order.refunded": return <RefreshCw size={14} className="text-orange-600" />;
      case "customer.registered": return <UserPlus size={14} className="text-green-600" />;
      case "order.fulfilled": return <Truck size={14} className="text-indigo-600" />;
      case "order.status_changed": return <ArrowRight size={14} className="text-gray-600" />;
      case "payment.failed": return <XCircle size={14} className="text-red-600" />;
      default: return <Bell size={14} className="text-gray-600" />;
    }
  };

  const handleMarkAllRead = () => {
    markAllRead({ 
      resource: "notifications", 
      id: "read-all", 
      values: {},
      successNotification: () => ({
        message: "All notifications marked as read",
        type: "success"
      })
    });
  };

  return (
    <div className="relative group">
      <button className="relative p-2.5 hover:bg-black/5 rounded-full transition-colors group">
        <Bell size={20} className="group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#FDFCF8] animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <div className="absolute right-0 mt-4 w-80 bg-white rounded-3xl border border-black/5 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] overflow-hidden">
         <div className="p-6 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest">Alerts</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-[9px] font-black uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity"
              >
                 Mark all read
              </button>
            )}
         </div>
         <div className="max-h-96 overflow-y-auto">
            {notifications?.data?.length ? (
              notifications.data.map((n: any) => (
                <div key={n.id} className={cn("p-4 flex gap-4 hover:bg-black/[0.02] transition-colors border-b border-black/[0.03]", !n.readAt && "bg-blue-50/30")}>
                   <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center flex-shrink-0">
                      {getIcon(n.type)}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">{n.title}</p>
                      <p className="text-xs font-bold leading-snug">{n.body}</p>
                      <p className="text-[9px] font-black opacity-30 uppercase tracking-widest mt-1.5">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                   </div>
                   {!n.readAt && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2" />}
                </div>
              ))
            ) : (
              <div className="p-10 text-center">
                 <Bell size={32} className="mx-auto opacity-10 mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No notifications</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
