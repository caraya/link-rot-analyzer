import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  CRAWL_COHORTS,
  getOrSampleBaselineCohorts,
  type CohortConfig,
  type HistoricalUrlRow,
} from "./crawler.js";

export interface CohortStatus {
  crawlId: string;
  fetchStatus: number | null; // e.g. 200, 404, or null if missing from index
  fetchTime?: string;
}

export interface HistoricalUrlAnalysis {
  url: string;
  initialCrawlYear: number;
  initialCrawlId: string;
  statusByYear: Record<number, CohortStatus>;
  isCurrentlyRotted: boolean; // true if missing or non-200 status in the latest cohort
}

export interface AnalysisSummary {
  totalAnalyzed: number;
  cohortYears: number[];
  survivalByYear: Record<number, { total: number; alive: number; survivalRate: number }>;
  rotRatePercentage: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  urls: HistoricalUrlAnalysis[];
}

/**
 * Analyzes the cross-cohort historical persistence of a baseline dataset of URLs.
 * Joins the baseline sample against Common Crawl index Parquet files across all defined crawl cohorts.
 */
export async function analyzeCrossCohortPersistence(
  baselineFile = "historical_sample.json",
  outputFile = "link_rot_analysis.json",
  forceReanalyze = false,
  dbPath = "link_rot.duckdb"
): Promise<AnalysisResult> {
  const outputPath = path.resolve(process.cwd(), outputFile);

  // If analysis already exists and re-analysis is not forced, load from disk
  if (!forceReanalyze) {
    try {
      const existingData = await fs.readFile(outputPath, "utf-8");
      const result: AnalysisResult = JSON.parse(existingData);
      console.log(
        `[Phase 2] Loaded cross-cohort analysis (${result.urls.length} URLs) from: ${outputPath}`
      );
      console.table(result.summary.survivalByYear);
      return result;
    } catch {
      console.log("[Phase 2] No existing analysis found. Running cross-cohort analysis engine...");
    }
  }

  // Get or load baseline cohort URLs from Phase 1
  const baselineRows: HistoricalUrlRow[] = await getOrSampleBaselineCohorts(
    5000,
    baselineFile,
    false,
    dbPath
  );

  if (baselineRows.length === 0) {
    throw new Error("[Phase 2] Baseline dataset is empty. Cannot perform cross-cohort analysis.");
  }

  // Initialize file-backed DuckDB instance
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();

  try {
    console.log("[Phase 2] Configuring DuckDB S3 client for cross-cohort analysis...");
    await connection.run("INSTALL httpfs;");
    await connection.run("LOAD httpfs;");
    await connection.run("SET s3_region='us-east-1';");
    await connection.run("SET s3_url_style='path';");
    await connection.run("SET s3_endpoint='s3.amazonaws.com';");

    // Create temporary table for baseline URLs
    await connection.run("DROP TABLE IF EXISTS temp_baseline;");
    await connection.run(`
      CREATE TABLE temp_baseline (
        url VARCHAR,
        initial_year INTEGER,
        initial_crawl_id VARCHAR,
        initial_fetch_time VARCHAR
      );
    `);

    // Insert baseline rows into DuckDB in manageable chunks
    console.log(`[Phase 2] Populating DuckDB temp table with ${baselineRows.length} baseline URLs...`);
    const chunkSize = 500;
    for (let i = 0; i < baselineRows.length; i += chunkSize) {
      const chunk = baselineRows.slice(i, i + chunkSize);
      const insertValues = chunk
        .map(
          (row) =>
            `('${row.url.replace(/'/g, "''")}', ${row.crawl_year}, '${row.crawl_id}', '${row.fetch_time}')`
        )
        .join(",\n");
      await connection.run(`INSERT INTO temp_baseline VALUES ${insertValues};`);
    }

    // Record cross-cohort fetch status per URL
    const urlMap = new Map<string, HistoricalUrlAnalysis>();

    for (const row of baselineRows) {
      const statusByYear: Record<number, CohortStatus> = {};
      for (const cohort of CRAWL_COHORTS) {
        // Default: if it's the cohort where the URL was sampled from, we know fetchStatus was 200
        if (cohort.year === row.crawl_year) {
          statusByYear[cohort.year] = {
            crawlId: cohort.crawlId,
            fetchStatus: 200,
            fetchTime: row.fetch_time,
          };
        } else {
          statusByYear[cohort.year] = {
            crawlId: cohort.crawlId,
            fetchStatus: null,
          };
        }
      }

      urlMap.set(row.url, {
        url: row.url,
        initialCrawlYear: row.crawl_year,
        initialCrawlId: row.crawl_id,
        statusByYear,
        isCurrentlyRotted: false,
      });
    }

    // Query each target cohort index in Common Crawl to check presence & status
    for (const cohort of CRAWL_COHORTS) {
      console.log(`[Phase 2] Checking persistence in ${cohort.year} crawl (${cohort.crawlId})...`);
      const s3Path = `s3://commoncrawl/cc-index/table/cc-main/warc/crawl=${cohort.crawlId}/subset=warc/part-00000-*.parquet`;

      const joinQuery = `
        SELECT
          b.url,
          cc.fetch_status,
          CAST(cc.fetch_time AS VARCHAR) AS fetch_time
        FROM temp_baseline b
        INNER JOIN read_parquet('${s3Path}') cc
          ON b.url = cc.url;
      `;

      try {
        console.time(`[Phase 2] Cohort ${cohort.year} Lookup`);
        const reader = await connection.runAndReadAll(joinQuery);
        console.timeEnd(`[Phase 2] Cohort ${cohort.year} Lookup`);

        const matchedRows = reader.getRows();
        console.log(`[Phase 2] Found ${matchedRows.length} matching URLs in ${cohort.year} crawl.`);

        for (const mRow of matchedRows) {
          const url = String(mRow[0]);
          const fetchStatus = mRow[1] !== null ? Number(mRow[1]) : null;
          const fetchTime = mRow[2] !== null ? String(mRow[2]) : undefined;

          const analysis = urlMap.get(url);
          if (analysis) {
            const statusObj: CohortStatus = {
              crawlId: cohort.crawlId,
              fetchStatus,
            };
            if (fetchTime !== undefined) {
              statusObj.fetchTime = fetchTime;
            }
            analysis.statusByYear[cohort.year] = statusObj;
          }
        }
      } catch (err) {
        console.error(`[Phase 2] Error querying cohort ${cohort.year}:`, err);
      }
    }

    // Determine current rot state and compute summary statistics
    const latestYear = Math.max(...CRAWL_COHORTS.map((c) => c.year));
    const analyzedUrls = Array.from(urlMap.values());

    for (const item of analyzedUrls) {
      const latestStatus = item.statusByYear[latestYear]?.fetchStatus;
      item.isCurrentlyRotted = latestStatus !== 200;
    }

    const cohortYears = CRAWL_COHORTS.map((c) => c.year);
    const survivalByYear: Record<number, { total: number; alive: number; survivalRate: number }> = {};

    for (const year of cohortYears) {
      let alive = 0;
      for (const item of analyzedUrls) {
        if (item.statusByYear[year]?.fetchStatus === 200) {
          alive++;
        }
      }
      survivalByYear[year] = {
        total: analyzedUrls.length,
        alive,
        survivalRate: Math.round((alive / analyzedUrls.length) * 10000) / 100,
      };
    }

    const rottedCount = analyzedUrls.filter((u) => u.isCurrentlyRotted).length;
    const rotRatePercentage = Math.round((rottedCount / analyzedUrls.length) * 10000) / 100;

    const summary: AnalysisSummary = {
      totalAnalyzed: analyzedUrls.length,
      cohortYears,
      survivalByYear,
      rotRatePercentage,
    };

    const result: AnalysisResult = {
      summary,
      urls: analyzedUrls,
    };

    console.log(`[Phase 2] Summary:`);
    console.table(survivalByYear);
    console.log(`[Phase 2] Overall Link Rot Rate (latest cohort ${latestYear}): ${rotRatePercentage}%`);

    // Clean up temp table
    await connection.run("DROP TABLE IF EXISTS temp_baseline;");

    // Write analysis dataset to disk
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`[Phase 2] Saved cross-cohort analysis to: ${outputPath}`);

    return result;
  } catch (error) {
    console.error("[Phase 2] Cross-cohort analysis failed:", error);
    process.exitCode = 1;
    throw error;
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

// Execute analyzer if executed directly from CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  analyzeCrossCohortPersistence();
}