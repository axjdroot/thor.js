"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCF8] text-[#121212] selection:bg-[#121212] selection:text-[#FDFCF8]">
      <header className="fixed top-0 w-full z-50 px-6 py-6 flex items-center justify-between backdrop-blur-sm">
        <div className="text-2xl font-extrabold tracking-tighter">THOR.JS</div>
        <nav className="hidden md:flex gap-10 text-sm font-semibold uppercase tracking-widest">
          <Link href="/products" className="hover:opacity-50 transition-opacity">Shop</Link>
          <Link href="/categories" className="hover:opacity-50 transition-opacity">Collections</Link>
          <Link href="/about" className="hover:opacity-50 transition-opacity">About</Link>
        </nav>
        <div className="flex gap-4">
          <Button variant="ghost" size="sm" className="font-bold">Search</Button>
          <Button variant="default" size="sm" className="rounded-full px-8 bg-[#121212] text-[#FDFCF8] font-bold">Cart (0)</Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="h-screen flex flex-col items-center justify-center text-center px-6 pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-7xl md:text-[12rem] font-black tracking-tighter mb-8 leading-[0.8] uppercase">
              The Edge <br /> of Commerce.
            </h1>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="max-w-2xl text-xl md:text-2xl text-muted-foreground mb-16 leading-relaxed"
          >
            Thor.js is a production-grade headless engine built for Cloudflare. 
            Blazing fast, infinitely scalable, and zero maintenance.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <Button size="lg" className="rounded-full px-16 py-10 text-2xl font-black bg-[#121212] text-[#FDFCF8] hover:scale-105 transition-all shadow-2xl">
              START SHOPPING
            </Button>
          </motion.div>
        </section>

        <section className="py-40 px-6 bg-[#121212] text-[#FDFCF8] rounded-[4rem] mx-4 mb-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-32 items-end">
              <div className="space-y-12">
                <span className="text-sm font-bold tracking-[0.3em] uppercase opacity-50">The Architecture</span>
                <h2 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none">ZERO COLD STARTS.</h2>
                <p className="text-2xl text-white/60 leading-relaxed max-w-lg">
                  Leverage Cloudflare's global network with D1 Database, KV Caching, and Durable Objects. 
                  Your store is always awake, everywhere.
                </p>
                <div className="flex flex-wrap gap-4 pt-8">
                  {['Drizzle ORM', 'Clerk Auth', 'Stripe', 'D1', 'KV'].map(tag => (
                    <span key={tag} className="px-8 py-3 border border-white/10 rounded-full text-sm font-bold bg-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="relative aspect-square bg-[#FDFCF8]/5 rounded-[3rem] border border-white/10 p-16 flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                    <circle cx="100" cy="100" r="100" fill="white" />
                  </svg>
                </div>
                <div className="text-xl font-mono opacity-50"># ANALYTICS_REALTIME</div>
                <div className="space-y-2">
                  <div className="text-[10rem] font-black leading-none tracking-tighter">14ms</div>
                  <div className="text-lg uppercase tracking-[0.2em] font-bold opacity-50">Average Latency</div>
                </div>
                <div className="h-3 bg-white/10 w-full rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: "95%" }}
                    transition={{ duration: 2, ease: "circOut" }}
                    className="h-full bg-[#FDFCF8] rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-24 px-10 flex flex-col md:flex-row justify-between items-center gap-12">
        <div className="text-3xl font-black tracking-tighter">THOR.JS</div>
        <div className="text-sm font-medium opacity-40 uppercase tracking-widest">
          © 2026 Thor Commerce Engine
        </div>
        <div className="flex gap-10 text-sm font-bold uppercase tracking-widest">
          <Link href="#" className="hover:opacity-50 transition-opacity">X</Link>
          <Link href="#" className="hover:opacity-50 transition-opacity">GitHub</Link>
          <Link href="#" className="hover:opacity-50 transition-opacity">Docs</Link>
        </div>
      </footer>
    </div>
  )
}
