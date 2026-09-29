"use client";

import { useState } from "react";
import { deleteProduct, addProduct, simulatePriceDropAction } from "@/app/action";
import PriceChart from "./PriceChart";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Package,
  Zap,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const stats = product.stats || {};
  const isDrop = stats.trend === "down";
  const isSurge = stats.trend === "up";

  const handleDelete = async () => {
    if (!confirm(`Stop tracking "${product.name}"?`)) return;

    setDeleting(true);
    const res = await deleteProduct(product.id);
    if (res?.error) {
      toast.error(res.error);
      setDeleting(false);
    } else {
      toast.success("Product removed from tracking.");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const formData = new FormData();
      formData.append("url", product.url);
      const res = await addProduct(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Price re-checked and updated!");
      }
    } catch (err) {
      toast.error("Failed to check price.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSimulateDrop = async () => {
    setSimulating(true);
    try {
      const res = await simulatePriceDropAction(product.id, 15);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `🎉 Price dropped by 15%! Saved ${product.currency} ${res.savings}. Alert email with graph sent!`,
          { duration: 5000 }
        );
        setShowChart(true);
      }
    } catch (err) {
      toast.error("Simulation failed.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Card className="bg-neutral-950/80 backdrop-blur-xl border border-white/15 text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-orange-500/40 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex gap-4 items-start">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-contain rounded-xl bg-white/5 border border-white/10 p-1.5 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 shrink-0">
              <Package className="w-8 h-8" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white line-clamp-2 mb-2 text-base leading-snug">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-black text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                {product.currency} {Number(product.current_price).toFixed(2)}
              </span>

              {/* Dynamic Price Trend Badges */}
              {isDrop && (
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/25">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Save {stats.diffPercent}%
                </Badge>
              )}

              {isSurge && (
                <Badge className="gap-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/25">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{stats.diffPercent}% Surge
                </Badge>
              )}

              {!isDrop && !isSurge && (
                <Badge
                  variant="outline"
                  className="gap-1 bg-cyan-400/10 text-cyan-300 border-cyan-400/30 text-xs font-semibold"
                >
                  <Tag className="w-3 h-3" />
                  Active Tracking
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Price History Chart */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-1.5 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4 text-orange-400" />
                Hide Graph
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-cyan-400" />
                View Price Graph
              </>
            )}
          </Button>

          {/* Simulate Price Drop Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulateDrop}
            disabled={simulating}
            className="gap-1.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
            title="Simulate a price drop to trigger email alert with price graph"
          >
            {simulating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Simulate Drop
          </Button>

          {/* Re-check price button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
            title="Fetch the latest price right now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-orange-400" : ""}`} />
            {refreshing ? "Checking..." : "Check"}
          </Button>

          {/* Link to external store */}
          <Link
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "gap-1.5 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white",
            })}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Store
          </Link>

          {/* Delete product */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto gap-1"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Remove
          </Button>
        </div>
      </CardContent>

      {showChart && (
        <CardFooter className="pt-0">
          <PriceChart productId={product.id} />
        </CardFooter>
      )}
    </Card>
  );
}
