"use client";

import { useState } from "react";
import { seedDemoProductsAction } from "@/app/action";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SeedDemoButton() {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await seedDemoProductsAction();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Loaded demo tracked products with price history!");
      }
    } catch (err) {
      toast.error("Failed to load demo products.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSeed}
      disabled={loading}
      variant="outline"
      className="mt-6 gap-2 bg-gradient-to-r from-orange-500/20 to-cyan-500/20 hover:from-orange-500/30 hover:to-cyan-500/30 border border-orange-400/40 text-white font-bold rounded-xl px-5 py-2.5 shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all hover:scale-105"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
          Loading Demo Trackers...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 text-orange-400" />
          Load Demo Products with Price Graphs
        </>
      )}
    </Button>
  );
}
