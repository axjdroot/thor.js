"use client";
export const runtime = "edge";


import { useForm } from "@refinedev/react-hook-form";
import { useNavigation } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save, FolderTree } from "lucide-react";
import * as React from "react";

export default function CategoryEditPage() {
  const { list } = useNavigation();
  const {
    refineCore,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      resource: "categories",
      action: "edit",
      redirect: "list",
    },
  });

  const { onFinish, formLoading, queryResult } = refineCore as any;

  const categoryData = queryResult?.data?.data;

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/5 pb-12">
        <div className="flex items-center gap-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-16 w-16 bg-black/5 hover:bg-black/10 transition-all group"
            onClick={() => list("categories")}
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </Button>
          <div>
            <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Refine</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Modifying: {categoryData?.name}</p>
          </div>
        </div>
        
        <Button 
          onClick={handleSubmit(onFinish)} 
          disabled={formLoading}
          className="rounded-full h-16 px-14 bg-[#121212] text-[#FDFCF8] font-black text-xs uppercase tracking-widest gap-4 shadow-2xl hover:scale-105 transition-all duration-500"
        >
          <Save size={20} />
          {formLoading ? "Saving..." : "Update Hierarchy"}
        </Button>
      </div>

      <div className="bg-white p-14 rounded-[4rem] border border-black/5 shadow-sm space-y-12">
        <div className="flex items-center gap-6 mb-8">
           <div className="w-20 h-20 bg-black/5 rounded-[2.5rem] flex items-center justify-center">
              <FolderTree size={32} className="opacity-20" />
           </div>
           <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase">Hierarchy Details</h2>
              <span className="text-[10px] font-black opacity-10 font-mono tracking-widest uppercase">UUID: {categoryData?.id}</span>
           </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-6">Category Name</Label>
            <Input 
              {...register("name", { required: "Name is required" })}
              className="h-20 text-2xl font-black bg-black/[0.02] border-none rounded-[1.75rem] px-10 focus-visible:ring-black/5"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-6">URL Slug</Label>
            <Input 
              {...register("slug")}
              className="h-16 text-sm font-black bg-black/[0.02] border-none rounded-[1.25rem] px-10 focus-visible:ring-black/5 font-mono"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-6">Description</Label>
            <textarea 
              {...register("description")}
              className="w-full min-h-[200px] bg-black/[0.02] border-none rounded-[2.5rem] p-10 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
