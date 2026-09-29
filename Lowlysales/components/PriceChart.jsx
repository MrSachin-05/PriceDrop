"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getPriceHistory } from "@/app/action";
import {
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export default function PriceChart({ productId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    min: 0,
    max: 0,
    first: 0,
    current: 0,
    diff: 0,
    diffPercent: 0,
    trend: "flat", // "down", "up", "flat"
  });

  useEffect(() => {
    async function loadData() {
      const history = await getPriceHistory(productId);

      if (!history || history.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const prices = history.map((h) => Number(h.price));
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const first = prices[0];
      const current = prices[prices.length - 1];
      const diff = current - first;
      const diffPercent = first > 0 ? ((diff / first) * 100).toFixed(1) : 0;

      let trend = "flat";
      if (diff < -0.01) trend = "down";
      else if (diff > 0.01) trend = "up";

      setStats({
        min,
        max,
        first,
        current,
        diff,
        diffPercent: Math.abs(diffPercent),
        trend,
      });

      const chartData = history.map((item, idx) => {
        const prevPrice = idx > 0 ? Number(history[idx - 1].price) : Number(item.price);
        const changeFromPrev = Number(item.price) - prevPrice;

        return {
          date: new Date(item.checked_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          time: new Date(item.checked_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          price: Number(item.price),
          currency: item.currency || "USD",
          changeFromPrev,
        };
      });

      setData(chartData);
      setLoading(false);
    }

    loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-white/50 w-full">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-orange-400" />
        Loading price history...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/50 w-full text-sm">
        No price history recorded yet. Initial price captured! Check back after updates.
      </div>
    );
  }

  const isPriceDrop = stats.trend === "down";
  const isPriceSurge = stats.trend === "up";

  // Gradient colors based on trend
  const strokeColor = isPriceDrop ? "#10b981" : isPriceSurge ? "#f43f5e" : "#f97316";
  const gradientId = `priceGradient-${productId}`;

  return (
    <div className="w-full pt-3 border-t border-white/10 mt-3">
      {/* Trend Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-white/40">
              Price Dynamic
            </span>

            {isPriceDrop && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <TrendingDown className="w-3.5 h-3.5" />
                Price Dropped {stats.diffPercent}%
              </span>
            )}

            {isPriceSurge && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                Price Increased +{stats.diffPercent}%
              </span>
            )}

            {!isPriceDrop && !isPriceSurge && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                <Minus className="w-3.5 h-3.5" />
                Price Stable
              </span>
            )}
          </div>
        </div>

        {/* Quick Min / Max Pill */}
        <div className="flex items-center gap-3 text-xs">
          <div className="text-emerald-400 font-medium">
            Low: <span className="font-bold">{data[0]?.currency} {stats.min}</span>
          </div>
          <div className="text-rose-400 font-medium">
            High: <span className="font-bold">{data[0]?.currency} {stats.max}</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={{ stroke: "#27272a" }}
              tickLine={false}
            />

            <YAxis
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={{ stroke: "#27272a" }}
              tickLine={false}
              domain={["auto", "auto"]}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  const delta = item.changeFromPrev;

                  return (
                    <div className="bg-neutral-900/95 border border-white/20 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs">
                      <div className="text-white/50 mb-1">
                        {item.date} • {item.time}
                      </div>

                      <div className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>{item.currency} {item.price.toFixed(2)}</span>

                        {delta < 0 && (
                          <span className="text-emerald-400 flex items-center text-xs font-bold">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {item.currency} {Math.abs(delta).toFixed(2)} drop
                          </span>
                        )}

                        {delta > 0 && (
                          <span className="text-rose-400 flex items-center text-xs font-bold">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            +{item.currency} {delta.toFixed(2)} surge
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <ReferenceLine
              y={stats.min}
              stroke="#10b981"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={{ fill: strokeColor, r: 3, strokeWidth: 1, stroke: "#000" }}
              activeDot={{ r: 6, fill: strokeColor, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
