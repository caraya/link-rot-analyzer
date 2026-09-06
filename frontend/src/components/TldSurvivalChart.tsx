import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TldMetric } from "../types.js";

interface TldSurvivalChartProps {
  tlds: TldMetric[];
}

export const TldSurvivalChart: React.FC<TldSurvivalChartProps> = ({ tlds }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || tlds.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const displayTlds = tlds.slice(0, 8);
    const width = svgRef.current.clientWidth || 500;
    const height = 260;
    const margin = { top: 20, right: 50, bottom: 25, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y Scale (TLD names)
    const yScale = d3
      .scaleBand<string>()
      .domain(displayTlds.map((d) => d.tld))
      .range([0, innerHeight])
      .padding(0.25);

    // X Scale (Survival rate 0-100%)
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);

    // Draw Bars
    g.selectAll(".bar")
      .data(displayTlds)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", (d) => yScale(d.tld)!)
      .attr("x", 0)
      .attr("height", yScale.bandwidth())
      .attr("width", (d) => xScale(d.survivalRate))
      .attr("rx", 4)
      .attr("fill", (d) => {
        if (d.survivalRate > 70) return "#10b981";
        if (d.survivalRate > 40) return "#38bdf8";
        return "#f43f5e";
      })
      .style("opacity", 0.85);

    // Bar Value Labels
    g.selectAll(".value-label")
      .data(displayTlds)
      .enter()
      .append("text")
      .attr("y", (d) => yScale(d.tld)! + yScale.bandwidth() / 2 + 4)
      .attr("x", (d) => xScale(d.survivalRate) + 8)
      .attr("fill", "#cbd5e1")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("font-family", "JetBrains Mono, monospace")
      .text((d) => `${d.survivalRate.toFixed(1)}%`);

    // Y Axis
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .attr("fill", "#e2e8f0")
      .attr("font-size", "12px")
      .attr("font-weight", "600");

    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat((d) => `${d}%`))
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "11px");

    // Style lines
    svg.selectAll(".domain").attr("stroke", "#334155");
    svg.selectAll(".tick line").attr("stroke", "#334155");

  }, [tlds]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Top-Level Domain Survival Rates</h3>
          <p className="text-xs text-slate-400">Survival rate (% active) grouped by TLD extension</p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          D3 Bar Chart
        </span>
      </div>
      <div className="w-full overflow-hidden">
        <svg ref={svgRef} className="w-full h-[260px]"></svg>
      </div>
    </div>
  );
};