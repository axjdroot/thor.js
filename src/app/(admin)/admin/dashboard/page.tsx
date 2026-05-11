"use client";

import { useList } from "@refinedev/core";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Package, ShoppingCart, Users, DollarSign } from "lucide-react";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const period = searchParams.get("period") || "7d";

  const { data: analytics, isLoading } = useList({
    resource: "analytics/summary",
    filters: [{ field: "period", operator: "eq", value: period }],
  }) as any;

  const stats = analytics?.data?.[0] || {
    revenue: { total: 0, change: 0 },
    orders: { total: 0, change: 0 },
    customers: { total: 0, change: 0 },
    aov: { total: 0, change: 0 },
    chartData: []
  };

  const setPeriod = (p: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("period", p);
    router.push(`/admin/dashboard?${params.toString()}`);
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Insights</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Real-time performance metrics</p>
        </div>
        
        <div className="flex bg-black/5 p-1 rounded-full border border-black/5">
          {["Today", "7d", "30d", "12m"].map((p: string) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                period === p ? "bg-[#121212] text-[#FDFCF8] shadow-2xl" : "text-[#121212]/40 hover:text-[#121212]"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue", value: `$${stats.revenue.total.toLocaleString()}`, change: stats.revenue.change, icon: <DollarSign size={18} /> },
          { label: "Orders", value: stats.orders.total.toLocaleString(), change: stats.orders.change, icon: <ShoppingCart size={18} /> },
          { label: "New Customers", value: stats.customers.total.toLocaleString(), change: stats.customers.change, icon: <Users size={18} /> },
          { label: "Avg Order Value", value: `$${stats.aov.total.toLocaleString()}`, change: stats.aov.change, icon: <Package size={18} /> },
        ].map((item: any) => (
          <div key={item.label} className="bg-white p-10 rounded-[3rem] border border-black/5 shadow-sm hover:shadow-2xl transition-all duration-500 group">
            <div className="flex items-center justify-between mb-8">
              <div className="w-14 h-14 bg-[#121212]/5 rounded-[1.25rem] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                {item.icon}
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest",
                item.change >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                {item.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(item.change)}%
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-2">{item.label}</div>
            <div className="text-4xl font-black tracking-tighter leading-none">
              {isLoading ? <Skeleton className="h-10 w-32 rounded-lg" /> : item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white p-12 rounded-[4rem] border border-black/5 shadow-sm">
        <div className="flex items-center justify-between mb-16">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">Revenue Growth</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Comparative analysis per period</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#121212]" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Current Period</span>
             </div>
          </div>
        </div>
        <div className="h-[450px] w-full">
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-3xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#121212" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#121212" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: "rgba(0,0,0,0.3)", letterSpacing: '0.1em' }} 
                  dy={25}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: "rgba(0,0,0,0.3)", letterSpacing: '0.1em' }}
                  tickFormatter={(v) => `$${v > 999 ? (v/1000).toFixed(1) + 'k' : v}`}
                />
                <Tooltip 
                  cursor={{ stroke: '#121212', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ 
                    borderRadius: '2rem', 
                    border: '1px solid rgba(0,0,0,0.05)', 
                    boxShadow: '0 30px 60px rgba(0,0,0,0.12)', 
                    padding: '1.5rem',
                    background: '#FDFCF8'
                  }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.1em' }}
                  itemStyle={{ fontSize: '14px', fontWeight: 900, color: '#121212', padding: 0 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#121212" 
                  strokeWidth={5} 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
