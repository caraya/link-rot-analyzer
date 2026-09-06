import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";

export interface HistoricalUrlRow {
  url: string;
  crawl_year: number;
  crawl_id: string;
  fetch_time: string;
}

export interface CohortConfig {
  year: number;
  crawlId: string;
}

export const CRAWL_COHORTS: CohortConfig[] = [
  { year: 2018, crawlId: "CC-MAIN-2018-17" },
  { year: 2021, crawlId: "CC-MAIN-2021-21" },
  { year: 2024, crawlId: "CC-MAIN-2024-18" },
];

/**
 * Builds a UNION ALL query sampling an equal count from each historical partition.
 */
export function buildCohortSampleQuery(
  cohorts: CohortConfig[],
  samplePerCohort: number
): string {
  return cohorts
    .map((cohort) => {
      const s3Path = `s3://commoncrawl/cc-index/table/cc-main/warc/crawl=${cohort.crawlId}/subset=warc/part-00000-*.parquet`;
      return `
        (
          SELECT
            url,
            ${cohort.year} AS crawl_year,
            '${cohort.crawlId}' AS crawl_id,
            CAST(fetch_time AS VARCHAR) AS fetch_time
          FROM read_parquet('${s3Path}')
          WHERE content_mime_detected = 'text/html'
            AND fetch_status = 200
            AND url LIKE 'http%'
          USING SAMPLE ${samplePerCohort}
        )
      `;
    })
    .join("\nUNION ALL\n");
}

/**
 * Loads or generates a frozen baseline dataset of sampled URLs.
 * Implements Phase 1 (Baseline Sampler & Data Persistence):
 * Checks if a baseline dataset file exists. If present, loads and reuses the canonical seed dataset.
 * Otherwise, queries Common Crawl index Parquet files on S3 using a file-backed DuckDB database (`link_rot.duckdb`)
 * with a fixed PRNG seed (`SET seed = 0.42;`) and saves the baseline dataset to disk (`historical_sample.json`).
 */
export async function getOrSampleBaselineCohorts(
  totalTarget = 5000,
  outputFile = "historical_sample.json",
  forceResample = false,
  dbPath = "link_rot.duckdb"
): Promise<HistoricalUrlRow[]> {
  const outputPath = path.resolve(process.cwd(), outputFile);

  // Phase 1 Persistence Check: load existing frozen baseline dataset if available
  if (!forceResample) {
    try {
      const existingData = await fs.readFile(outputPath, "utf-8");
      const rows: HistoricalUrlRow[] = JSON.parse(existingData);
      console.log(
        `[Phase 1] Loaded frozen baseline dataset (${rows.length} URLs) from: ${outputPath}`
      );
      const summary = rows.reduce<Record<number, number>>((acc, row) => {
        acc[row.crawl_year] = (acc[row.crawl_year] || 0) + 1;
        return acc;
      }, {});
      console.table(summary);
      return rows;
    } catch {
      console.log("[Phase 1] No existing frozen baseline dataset found. Generating new baseline...");
    }
  }

  const samplePerCohort = Math.ceil(totalTarget / CRAWL_COHORTS.length);

  // Initialize file-backed DuckDB instance and connection for persistent state and crash resilience
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();

  try {
    console.log("[Phase 1] Configuring DuckDB S3 client via @duckdb/node-api...");

    // Install and configure httpfs, and set a fixed random seed for reproducible baseline generation
    await connection.run("INSTALL httpfs;");
    await connection.run("LOAD httpfs;");
    await connection.run("SET s3_region='us-east-1';");
    await connection.run("SET s3_url_style='path';");
    await connection.run("SET s3_endpoint='s3.amazonaws.com';");
    await connection.run("SELECT setseed(0.42);");

    console.log(
      `[Phase 1] Sampling ~${samplePerCohort} URLs per cohort (${CRAWL_COHORTS.map((c) => c.year).join(", ")})...`
    );

    const query = buildCohortSampleQuery(CRAWL_COHORTS, samplePerCohort);

    console.time("DuckDB Multi-Cohort Query");
    const reader = await connection.runAndReadAll(query);
    console.timeEnd("DuckDB Multi-Cohort Query");

    // Convert Arrow-backed results to plain JavaScript objects
    const rows: HistoricalUrlRow[] = reader.getRows().map((row) => ({
      url: String(row[0]),
      crawl_year: Number(row[1]),
      crawl_id: String(row[2]),
      fetch_time: String(row[3]),
    }));

    console.log(`[Phase 1] Total URLs collected for baseline: ${rows.length}`);

    // Print cohort distribution
    const summary = rows.reduce<Record<number, number>>((acc, row) => {
      acc[row.crawl_year] = (acc[row.crawl_year] || 0) + 1;
      return acc;
    }, {});
    console.table(summary);

    // Save structured canonical dataset to disk
    await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), "utf-8");
    console.log(`[Phase 1] Saved frozen baseline dataset to: ${outputPath}`);
    return rows;
  } catch (error) {
    console.error("[Phase 1] Failed to query historical cohorts:", error);
    process.exitCode = 1;
    return [];
  } finally {
    // Explicitly disconnect connection and terminate the instance
    connection.closeSync();
    instance.closeSync();
  }
}

// Execute sampler if executed directly from CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  getOrSampleBaselineCohorts(5000, "historical_sample.json");
}
