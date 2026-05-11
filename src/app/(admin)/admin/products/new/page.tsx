"use client";

import { useForm } from "@refinedev/react-hook-form";
import { useNavigation } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save, Sparkles, UploadCloud, Loader2, X } from "lucide-react";
import * as React from "react";

export default function ProductCreatePage() {
  const { list } = useNavigation();
  const [isSynthesizing, setIsSynthesizing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [media, setMedia] = React.useState<{ url: string; key: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    refineCore: { onFinish, formLoading },
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    refineCoreProps: {
      resource: "products",
      action: "create",
      redirect: "list",
    },
  });

  const productName = watch("name");
  const description = watch("description");

  const handleSynthesize = async (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Synthesize button clicked");
    
    if (!productName) {
      alert("Please enter a product name first");
      return;
    }

    setIsSynthesizing(true);
    try {
      console.log("Fetching AI synthesis...");
      const res = await fetch("/api/v1/admin/ai/synthesize", {
        method: "POST",
        body: JSON.stringify({ name: productName, currentDescription: description }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      console.log("AI Response:", data);
      if (data.description) {
        setValue("description", data.description);
      }
    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to synthesize description");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input changed");
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log("Uploading file...");
      const res = await fetch("/api/v1/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log("Upload Response:", data);
      if (data.url) {
        const newMedia = [...media, { url: data.url, key: data.key }];
        setMedia(newMedia);
        setValue("images", newMedia.map(m => m.url));
      }
    } catch (error) {
      console.error("Upload Error:", error);
      alert("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = (key: string) => {
    const newMedia = media.filter(m => m.key !== key);
    setMedia(newMedia);
    setValue("images", newMedia.map(m => m.url));
  };

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
            <h1 className="text-6xl font-black tracking-tighter uppercase mb-2">Build</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Define a new commerce artifact</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           <Button variant="ghost" className="rounded-full px-12 h-16 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-black/5">Dismiss</Button>
           <Button 
              onClick={handleSubmit(onFinish)} 
              disabled={formLoading}
              className="rounded-full h-16 px-14 bg-[#121212] text-[#FDFCF8] font-black text-xs uppercase tracking-widest gap-4 shadow-2xl hover:scale-105 transition-all duration-500 active:scale-95"
            >
              <Save size={20} />
              {formLoading ? "Processing..." : "Confirm Creation"}
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
                    <Button 
                      type="button"
                      onClick={handleSynthesize}
                      disabled={isSynthesizing}
                      variant="ghost" 
                      className="h-10 text-[9px] font-black uppercase tracking-widest gap-3 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-full px-6 transition-all disabled:opacity-50"
                    >
                       {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                       {isSynthesizing ? "Synthesizing..." : "AI Synthesize"}
                    </Button>
                 </div>
                 <textarea 
                   {...register("description")}
                   className="w-full min-h-[350px] bg-black/[0.02] border-none rounded-[3.5rem] p-12 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black/5 transition-all leading-relaxed placeholder:opacity-10"
                   placeholder="Craft the vision for this product..."
                 />
              </div>
           </div>

           {/* Media Assets */}
           <div className="bg-white p-14 rounded-[4rem] border border-black/5 shadow-sm space-y-12">
              <div className="flex items-center justify-between px-6">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Visual Assets</h2>
                <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">{media.length} / 10 Uploaded</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-6">
                {media.map((m) => (
                  <div key={m.key} className="relative aspect-square rounded-[2rem] overflow-hidden group border border-black/5">
                    <img src={m.url} alt="Product asset" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => removeMedia(m.key)}
                      className="absolute top-4 right-4 w-8 h-8 bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
              
              <div 
                onClick={(e) => { e.preventDefault(); console.log("Upload area clicked"); fileInputRef.current?.click(); }}
                className="border-4 border-dashed border-black/5 rounded-[3.5rem] p-24 flex flex-col items-center justify-center text-center gap-8 group hover:border-black/10 transition-all duration-500 cursor-pointer bg-black/[0.01]"
              >
                 <div className="w-24 h-24 bg-black/5 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    {isUploading ? <Loader2 size={36} className="animate-spin opacity-20" /> : <UploadCloud size={36} className="opacity-20" />}
                 </div>
                 <div>
                    <p className="text-xl font-black tracking-tight">{isUploading ? "Uploading..." : "Deploy Assets"}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-20 mt-3">Drag files or click to browse</p>
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
                       <input 
                         {...register("price", { valueAsNumber: true })}
                         type="number" 
                         className="flex h-20 w-full pl-16 text-2xl font-black bg-black/[0.02] border-none rounded-[1.75rem] focus-visible:ring-black/5 px-3 py-2 outline-none" 
                         placeholder="0.00"
                       />
                    </div>
                 </div>
                 <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">Compare At</Label>
                    <div className="relative opacity-60 group">
                       <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-xl opacity-20 group-focus-within:opacity-100 transition-opacity">$</span>
                       <input type="number" className="flex h-20 w-full pl-16 text-2xl font-black bg-black/[0.02] border-none rounded-[1.75rem] focus-visible:ring-black/5 px-3 py-2 outline-none" placeholder="0.00" />
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
                       <option>Select Hierarchy</option>
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
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">SKU / ID</Label>
                <Input 
                   {...register("sku")}
                   className="h-16 text-sm font-black bg-black/[0.02] border-none rounded-[1.25rem] px-8 placeholder:opacity-20 uppercase tracking-widest focus-visible:ring-black/5"
                   placeholder="e.g. THC-Hood-001"
                />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
