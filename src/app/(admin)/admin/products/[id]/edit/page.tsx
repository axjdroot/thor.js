"use client";
export const runtime = "edge";


import { useForm } from "@refinedev/react-hook-form";
import { useNavigation } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save, Sparkles, UploadCloud, Trash2 } from "lucide-react";
import * as React from "react";

export default function ProductEditPage() {
  const { list } = useNavigation();
  const {
    refineCore,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      resource: "products",
      action: "edit",
      redirect: "list",
    },
  });

  const { onFinish, formLoading, queryResult } = refineCore as any;

  const productData = queryResult?.data?.data;

  return (
    <div className="space-y-12 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/5 pb-12">
        <div className="flex items-center gap-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-16 w-16 bg-black/5 hover:bg-black/10 transition-all group"
            onClick={() => list("products")}
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </Button>
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-6xl font-black tracking-tighter uppercase">Modify</h1>
              <span className="text-xl font-black opacity-10 font-mono">#{productData?.id?.substring(0, 8)}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Updating commerce artifact: {productData?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           <Button variant="ghost" className="rounded-full px-12 h-16 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5">Cancel</Button>
           <Button 
              onClick={handleSubmit(onFinish)} 
              disabled={formLoading}
              className="rounded-full h-16 px-14 bg-[#121212] text-[#FDFCF8] font-black text-xs uppercase tracking-widest gap-4 shadow-2xl hover:scale-105 transition-all duration-500 active:scale-95"
            >
              <Save size={20} />
              {formLoading ? "Saving..." : "Update Artifact"}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* Left Column: Core Definition */}
        <div className="lg:col-span-2 space-y-16">
           <div className="bg-white p-14 rounded-[4rem] border border-black/5 shadow-sm space-y-12">
              <div className="space-y-6">
                 <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-6">Product Title</Label>
                 <Input 
                   {...register("name", { required: "A name is mandatory" })}
                   className="h-24 text-4xl font-black tracking-tighter bg-black/[0.02] border-none rounded-[2.5rem] px-12 placeholder:opacity-10 focus-visible:ring-black/5"
                   placeholder="e.g. Midnight Onyx Hoodie"
                 />
                 {errors.name && <span className="text-red-500 text-[10px] font-black uppercase tracking-widest px-8">{errors.name.message as string}</span>}
              </div>

              <div className="space-y-6">
                 <div className="flex items-center justify-between px-6">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">Narrative</Label>
                    <Button variant="ghost" className="h-10 text-[9px] font-black uppercase tracking-widest gap-3 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-full px-6 transition-all">
                       <Sparkles size={14} />
                       Refine with AI
                    </Button>
                 </div>
                 <textarea 
                   {...register("description")}
                   className="w-full min-h-[350px] bg-black/[0.02] border-none rounded-[3.5rem] p-12 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black/5 transition-all leading-relaxed placeholder:opacity-10"
                   placeholder="Re-craft the vision..."
                 />
              </div>
           </div>

           {/* Media Assets */}
           <div className="bg-white p-14 rounded-[4rem] border border-black/5 shadow-sm space-y-12">
              <div className="flex items-center justify-between px-6">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Visual Assets</h2>
                <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">Modified / Original</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 {productData?.images?.map((img: any, i: number) => (
                   <div key={i} className="aspect-square bg-black/5 rounded-[2rem] overflow-hidden relative group border border-black/5">
                      <img src={img.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-12 w-12">
                            <Trash2 size={20} />
                         </Button>
                      </div>
                   </div>
                 ))}
                 <div className="aspect-square border-4 border-dashed border-black/5 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4 hover:border-black/10 transition-all cursor-pointer bg-black/[0.01]">
                    <UploadCloud size={24} className="opacity-20" />
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-20">Add Asset</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: Parameters */}
        <div className="space-y-16">
           {/* Economics */}
           <div className="bg-white p-12 rounded-[3.5rem] border border-black/5 shadow-sm space-y-12">
              <h2 className="text-xl font-black tracking-tighter uppercase px-4">Economics</h2>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">Listing Price</Label>
                    <div className="relative group">
                       <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-xl opacity-20 group-focus-within:opacity-100 transition-opacity">$</span>
                       <Input 
                         {...register("price", { valueAsNumber: true })}
                         type="number" 
                         className="h-20 pl-16 text-2xl font-black bg-black/[0.02] border-none rounded-[1.75rem] focus-visible:ring-black/5" 
                       />
                    </div>
                 </div>
              </div>
           </div>

           {/* Classification */}
           <div className="bg-white p-12 rounded-[3.5rem] border border-black/5 shadow-sm space-y-12">
              <h2 className="text-xl font-black tracking-tighter uppercase px-4">Classification</h2>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">Category</Label>
                    <select className="w-full h-20 bg-black/[0.02] border-none rounded-[1.75rem] px-8 text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-black/5 outline-none appearance-none cursor-pointer hover:bg-black/[0.04] transition-colors">
                       <option>{productData?.category?.name || "Select Hierarchy"}</option>
                       <option>Apparel</option>
                       <option>Footwear</option>
                       <option>Equipment</option>
                    </select>
                 </div>
                 <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">Release Status</Label>
                    <select 
                      {...register("status")}
                      className="w-full h-20 bg-black/[0.02] border-none rounded-[1.75rem] px-8 text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-black/5 outline-none appearance-none cursor-pointer hover:bg-black/[0.04] transition-colors"
                    >
                       <option value="draft">Draft (Private)</option>
                       <option value="active">Active (Public)</option>
                       <option value="archived">Archived</option>
                    </select>
                 </div>
              </div>
           </div>

           {/* Stock Identification */}
           <div className="bg-white p-12 rounded-[3.5rem] border border-black/5 shadow-sm space-y-8">
              <h2 className="text-xl font-black tracking-tighter uppercase px-4">Identification</h2>
              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">SKU / ID Reference</Label>
                <Input 
                  {...register("sku")}
                  className="h-16 text-sm font-black bg-black/[0.02] border-none rounded-[1.25rem] px-8 placeholder:opacity-20 uppercase tracking-widest focus-visible:ring-black/5"
                />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
