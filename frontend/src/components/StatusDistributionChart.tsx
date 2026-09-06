import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AnalysisSummary } from "../types.js";

interface StatusDistributionChartProps {
  summary: AnalysisSummary;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  summary,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const latestYear = Math.max(...summary.cohortYears);
  const latestMetric = summary.survivalByYear[latestYear] || {
    total: 0,
    alive: 0,
    survivalRate: 0,
  };
  const rottedCount = latestMetric.total - latestMetric.alive;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 320;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 20;

    const data = [
      { label: "Active (200 OK)", count: latestMetric.alive, color: "#10b981" },
      { label: "Rotted / Missing", count: rottedCount, color: "#f43f5e" },
    ];

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<{ label: string; count: number; color: string }>()
      .value((d) => d.count)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; count: number; color: string }>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .cornerRadius(4);

    const arcs = g.selectAll(".arc").data(pie(data)).enter().append("g").attr("class", "arc");

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", "2px")
      .style("opacity", 0.9);

    // Center Text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#f8fafc")
      .attr("font-size", "22px")
      .attr("font-weight", "700")
      .attr("font-family", "JetBrains Mono, monospace")
      .text(`${summary.rotRatePercentage.toFixed(0)}%`);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.4em")
      .attr("fill", "#94a3b8")
      .attr("font-size", "11px")
      .text(`Rot Rate (${latestYear})`);
  }, [summary, latestMetric.alive, rottedCount, latestYear]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Current Status Ratio</h3>
          <p className="text-xs text-slate-400">Latest crawl ({latestYear}) status breakdown</p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
          D3 Donut
        </span>
      </div>

      <div className="flex flex-col items-center">
        <svg ref={svgRef} className="w-full h-[220px] max-w-[280px]"></svg>

        <div className="flex items-center justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-slate-300">Active ({latestMetric.alive})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            <span className="text-slate-300">Rotted ({rottedCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};