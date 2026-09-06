import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AnalysisSummary } from "../types.js";

interface SurvivalCurveChartProps {
  summary: AnalysisSummary;
}

export const SurvivalCurveChart: React.FC<SurvivalCurveChartProps> = ({ summary }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous renders

    const width = svgRef.current.clientWidth || 500;
    const height = 260;
    const margin = { top: 25, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const data = summary.cohortYears.map((year) => {
      const metric = summary.survivalByYear[year] || { total: 0, alive: 0, survivalRate: 0 };
      return {
        year,
        survivalRate: metric.survivalRate,
        alive: metric.alive,
        total: metric.total,
      };
    });

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const xScale = d3
      .scalePoint<number>()
      .domain(data.map((d) => d.year))
      .range([0, innerWidth])
      .padding(0.2);

    // Y Scale
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Gridlines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "#1e293b")
      .attr("stroke-dasharray", "3,3");

    // Area Generator
    const area = d3
      .area<{ year: number; survivalRate: number }>()
      .x((d) => xScale(d.year)!)
      .y0(innerHeight)
      .y1((d) => yScale(d.survivalRate))
      .curve(d3.curveMonotoneX);

    // Gradient
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "area-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.4);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.0);

    // Draw Gradient Area
    g.append("path")
      .datum(data)
      .attr("fill", "url(#area-gradient)")
      .attr("d", area);

    // Line Generator
    const line = d3
      .line<{ year: number; survivalRate: number }>()
      .x((d) => xScale(d.year)!)
      .y((d) => yScale(d.survivalRate))
      .curve(d3.curveMonotoneX);

    // Draw Line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#22d3ee")
      .attr("stroke-width", 3)
      .attr("d", line);

    // Draw Data Points & Labels
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.year)!)
      .attr("cy", (d) => yScale(d.survivalRate))
      .attr("r", 6)
      .attr("fill", "#090d16")
      .attr("stroke", "#22d3ee")
      .attr("stroke-width", 2.5);

    // Data value labels
    g.selectAll(".label")
      .data(data)
      .enter()
      .append("text")
      .attr("x", (d) => xScale(d.year)!)
      .attr("y", (d) => yScale(d.survivalRate) - 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#38bdf8")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text((d) => `${d.survivalRate.toFixed(1)}%`);

    // X Axis
    const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d} Crawl`);
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "12px");

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}%`);
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "11px");

    // Style Axis lines
    svg.selectAll(".domain").attr("stroke", "#334155");
    svg.selectAll(".tick line").attr("stroke", "#334155");

  }, [summary]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Link Survival Decay Curve</h3>
          <p className="text-xs text-slate-400">Survival rate (% 200 OK) across historical crawl cohorts</p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          D3 Line Chart
        </span>
      </div>
      <div className="w-full overflow-hidden">
        <svg ref={svgRef} className="w-full h-[260px]"></svg>
      </div>
    </div>
  );
};