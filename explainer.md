# Link Rot Analyzer: Architectural & Process Explainer

A comprehensive guide explaining **what** the Link Rot Analyzer does, **how** it works under the hood, and **how** its independent modules interconnect.

---

## Table of Contents

1. [High-Level Overview & Core Concepts](#1-high-level-overview--core-concepts)
2. [System Architecture & Component Topology](#2-system-architecture--component-topology)
3. [Deep-Dive: The Core Processes](#3-deep-dive-the-core-processes)
   - [Process A: Macro Historical Decay Modeling (Common Crawl)](#process-a-macro-historical-decay-modeling-common-crawl)
   - [Process B: Wikipedia Citation & Dual-Source Tracking](#process-b-wikipedia-citation--dual-source-tracking)
   - [Process C: Targeted Live Verification & Internet Archive Fallback](#process-c-targeted-live-verification--internet-archive-fallback)
   - [Process D: Interactive UI & D3 Visualization Workspaces](#process-d-interactive-ui--d3-visualization-workspaces)
4. [Component Relationship & Coupling Matrix](#4-component-relationship--coupling-matrix)
5. [Classification Logic & Risk Scoring Engine](#5-classification-logic--risk-scoring-engine)
6. [Data Flow Diagrams](#6-data-flow-diagrams)

---

## 1. High-Level Overview & Core Concepts

Link rot is the process by which hyperlinks on the World Wide Web cease to point to their originally targeted web page, server, or resource over time.

The **Link Rot Analyzer** addresses two distinct challenges in link rot research and remediation:

```mermaid
flowchart LR
    subgraph Macro["Macro Research Engine (Historical Trends)"]
        direction TB
        M1["Common Crawl CDX Indexes<br/>(2013 → Present)"] --> M2["Cross-Cohort Persistence Engine"]
        M2 --> M3["Survival Decay Curves & TLD Analytics"]
    end

    subgraph Micro["Targeted Operational Auditor (Actionable Verification)"]
        direction TB
        T1["Custom URLs / Domain Input"] --> T2["MediaWiki exturlusage API"]
        T1 --> T3["Live HTTP Probing (HEAD/GET)"]
        T1 --> T4["Wayback Machine CDX & Availability"]
        T2 & T3 & T4 --> T5["Critical Citation Rot & Backup Recovery"]
    end
```

1. **Macro Web Decay Research**: Quantifies structural decay rates across large longitudinal samples of the web over 5 to 12+ years using [Common Crawl](https://commoncrawl.org/) historical archives.
2. **Targeted / Operational Auditing**: Audits specific arbitrary URLs or domains in real time, determining whether they are actively cited in [Wikipedia](https://www.wikipedia.org/) articles, whether they are currently dead, and whether archival copies exist on the [Internet Archive Wayback Machine](https://archive.org/web/).

---

## 2. System Architecture & Component Topology

The platform is designed with **strict decoupling**—each subsystem can run as a standalone CLI tool, as an isolated API endpoint, or through the unified React frontend.

```mermaid
graph TD
    subgraph CLI["CLI Runner Layer (Standalone Executables)"]
        C_Sample["npm run sample<br/>(crawler.ts)"]
        C_Analyze["npm run analyze<br/>(analyzer.ts)"]
        C_Track["npm run track<br/>(url-tracker.ts)"]
        C_Wiki["npm run wiki<br/>(wikipedia-client.ts)"]
        C_Inspect["npm run inspect<br/>(inspector.ts)"]
        C_Live["npm run verify-live<br/>(live-verifier.ts)"]
        C_Wayback["npm run wayback<br/>(wayback-client.ts)"]
    end

    subgraph Core["Core Processing Modules (src/)"]
        Crawler["crawler.ts<br/>Cohort Catalog (2013-2025) & Baseline Sampler"]
        Analyzer["analyzer.ts<br/>Cross-Cohort Persistence Engine"]
        Tracker["url-tracker.ts<br/>Batch Orchestrator & Risk Classifier"]
        WikiClient["wikipedia-client.ts<br/>MediaWiki exturlusage Client"]
        LiveVerifier["live-verifier.ts<br/>Redirect-Following HTTP Prober"]
        WaybackClient["wayback-client.ts<br/>Wayback Availability & CDX Client"]
        Inspector["inspector.ts<br/>Single-URL Composite Inspector"]
    end

    subgraph API["Backend Server (src/server.ts)"]
        Server["Node.js HTTP Server (:3000)"]
        Cache["In-Memory Analysis Cache (Lazy Loaded)"]
    end

    subgraph Frontend["Frontend Client (frontend/src/)"]
        App["App.tsx (Root Workspace Router)"]
        Nav["Navbar.tsx"]
        MacroWS["MacroOverview.tsx<br/>(D3 Survival Curves & TLD Bars)"]
        ExplorerWS["UrlExplorerTable.tsx<br/>(Searchable Dataset)"]
        TrackerWS["UrlTracker.tsx<br/>(Custom Batch & Cohort Depth)"]
        InspectorWS["UrlInspector.tsx<br/>(Live Probe & Archive Viewer)"]
    end

    %% Wiring
    Crawler --> Analyzer
    Tracker --> WikiClient
    Tracker --> LiveVerifier
    Tracker --> WaybackClient
    Tracker --> Crawler
    Inspector --> LiveVerifier
    Inspector --> WaybackClient

    Analyzer -.-> Cache
    Cache --> Server
    Tracker --> Server
    Inspector --> Server
    WikiClient --> Server
    Crawler --> Server

    Server --> Frontend
```

---

## 3. Deep-Dive: The Core Processes

### Process A: Macro Historical Decay Modeling (Common Crawl)

**Objective**: Model how URLs from an initial baseline cohort (e.g., 2018 or 2013) persist or disappear across subsequent crawl years.

```mermaid
sequenceDiagram
    autonumber
    actor Researcher
    participant Crawler as crawler.ts
    participant CC_API as index.commoncrawl.org
    participant Analyzer as analyzer.ts
    participant Disk as JSON Storage

    Researcher->>Crawler: Request baseline cohort sample (e.g. 1,000 URLs)
    Crawler->>CC_API: GET /collinfo.json (Discover collections)
    Crawler->>CC_API: Query CDX index for sample domains
    Note over Crawler,CC_API: If blocked by VPN/network, generate offline deterministic baseline
    Crawler->>Disk: Save historical_sample.json

    Researcher->>Analyzer: Execute cross-cohort persistence analysis
    Analyzer->>Disk: Load historical_sample.json
    loop For Each Cohort Year (e.g., 2018, 2021, 2024)
        Analyzer->>CC_API: Query CDX for each URL's status in that cohort
    end
    Analyzer->>Analyzer: Compute survival rates & classify rot
    Analyzer->>Disk: Save link_rot_analysis.json
```

1. **Cohort Discovery**: `crawler.ts` fetches `https://index.commoncrawl.org/collinfo.json` to enumerate all available crawls from 2013 to 2025.
2. **Baseline Sampling**: A diverse sample of URLs is captured from the earliest cohort (e.g., `CC-MAIN-2018-17`).
3. **Cross-Cohort Evaluation**: `analyzer.ts` iterates through subsequent crawl snapshots (e.g., 2021, 2024) and queries the CDX index server for each URL.
4. **Persistence Mathematics**:
   $$\text{Survival Rate}(Y) = \frac{\text{Count of URLs alive in cohort } Y}{\text{Total baseline URLs}} \times 100$$
5. **Lazy Loading**: The backend server caches this dataset in memory upon first request to `/api/summary` or `/api/urls`, ensuring instantaneous response times for subsequent queries.

---

### Process B: Wikipedia Citation & Dual-Source Tracking

**Objective**: Allow users to input custom URLs and discover whether those URLs are actively cited in Wikipedia articles, check their historical crawl presence across configurable cohorts, and assess link rot vulnerability.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Tracker as url-tracker.ts
    participant MediaWiki as en.wikipedia.org/w/api.php
    participant CC_CDX as Common Crawl CDX
    participant Live as live-verifier.ts
    participant Wayback as wayback-client.ts

    User->>Tracker: Submit URLs + Cohort Depth (e.g., startYear: 2013)
    par Wikipedia Citation Discovery
        Tracker->>MediaWiki: GET ?action=query&list=exturlusage&euquery={domain/path}
        MediaWiki-->>Tracker: Matching Wikipedia articles & page IDs
    and Common Crawl Cohort History
        Tracker->>CC_CDX: Query presence across selected cohorts (2013..2025)
        CC_CDX-->>Tracker: Status per cohort (200, 404, omitted)
    and Real-Time Verification
        Tracker->>Live: HEAD / GET probe with redirect following
        Live-->>Tracker: HTTP status code, response time
    and Archival Lookup
        Tracker->>Wayback: Availability & CDX snapshot search
        Wayback-->>Tracker: Preserved snapshot URLs & counts
    end
    Tracker->>Tracker: Compute combined risk score (Critical, High, Medium, Low)
    Tracker-->>User: Structured BatchTrackResponse (JSON/UI/CSV)
```

1. **Normalization**: `normalizeUrlForWikipedia()` strips protocols (`http://`, `https://`) and URL fragments (`#section`), formatting the string for MediaWiki's `euquery` parameter.
2. **MediaWiki Query**: Hits `https://en.wikipedia.org/w/api.php?action=query&list=exturlusage` (restricted to namespace `0` for main encyclopedic articles).
3. **Configurable Historical Depth**: Resolves the exact list of Common Crawl cohorts requested (e.g., full 11+ year depth from 2013, 10-year decade, or custom step intervals).
4. **Parallel Execution**: Uses `Promise.all` with bounded batch concurrency to query Wikipedia, Common Crawl, live HTTP status, and Wayback Machine in parallel.

---

### Process C: Targeted Live Verification & Internet Archive Fallback

**Objective**: Perform high-speed, accurate live HTTP verification and retrieve preserved Wayback Machine fallbacks for broken links.

```mermaid
flowchart TD
    Start(["Target URL"]) --> Step1["Send HTTP HEAD Request (follow redirects)"]
    Step1 --> CheckHead{"HEAD Success?<br/>(200-299 / 304)"}
    CheckHead -- Yes --> Alive["Mark ALIVE (Status 200/304)"]
    CheckHead -- "No (405 / 403 / 400 / Network Error)" --> Step2["Fallback: Send HTTP GET Request"]
    Step2 --> CheckGet{"GET Status 200-299 / 304?"}
    CheckGet -- Yes --> Alive
    CheckGet -- No --> Dead["Mark DEAD / UNREACHABLE"]

    Dead --> WB_Avail["Query Wayback Availability API"]
    Dead --> WB_CDX["Query Wayback CDX Index"]
    WB_Avail & WB_CDX --> CheckArchive{"Archived Snapshots Found?"}
    CheckArchive -- Yes --> FoundArchive["Provide Fallback URL & Snapshot Count"]
    CheckArchive -- No --> NoArchive["Flag as Permanently Lost"]
```

1. **Smart Probing**: Initiates a fast `HEAD` request to reduce bandwidth. If the origin server rejects `HEAD` (HTTP 405 Method Not Allowed) or blocks automated HEAD requests (HTTP 403/400), it automatically falls back to an HTTP `GET` with complete redirect following.
2. **Reconciliation**: If a URL is missing from historical Common Crawl indexes but responds with `200 OK` on a live check, it is classified as *Recovered / Transient Historical Outage* rather than true link rot.
3. **Dual-API Wayback Search**: Hits both the Internet Archive **Availability API** (for fastest closest snapshot retrieval) and the **CDX Server API** (for total snapshot count and earliest archive date).

---

### Process D: Interactive UI & D3 Visualization Workspaces

**Objective**: Provide an accessible, responsive dashboard that allows researchers to inspect data visually without cross-tab blocking.

- **Workspace Independence**: The React frontend (`App.tsx`) routes between 4 completely decoupled views:
  1. `MacroOverview.tsx`: D3 survival decay curves, donut charts, TLD distributions, top domain statistics.
  2. `UrlExplorerTable.tsx`: Searchable, filterable pagination table for the baseline crawl dataset.
  3. `UrlTracker.tsx`: Interactive multi-URL submission form with cohort preset selection, depth sliders, Wikipedia citation links, and CSV/JSON export.
  4. `UrlInspector.tsx`: Deep-dive live HTTP header inspector and Wayback timeline viewer.
- **Non-Blocking Architecture**: If the macro benchmark dataset is still generating or re-analyzing, users can use the URL Tracker and URL Inspector without interruption.

---

## 4. Component Relationship & Coupling Matrix

| Component | Primary Function | Upstream Dependencies | Downstream Consumers | Standalone CLI Command |
| :--- | :--- | :--- | :--- | :--- |
| **`crawler.ts`** | Common Crawl collection discovery & baseline sampling | Common Crawl Index API | `analyzer.ts`, `url-tracker.ts`, `server.ts` | `npm run sample` |
| **`analyzer.ts`** | Cross-cohort survival modeling & DuckDB analytics | `crawler.ts`, Common Crawl CDX | `server.ts` (lazy cached) | `npm run analyze` |
| **`live-verifier.ts`** | Lightweight HTTP probing & redirect tracing | Node.js native `fetch` | `inspector.ts`, `url-tracker.ts` | `npm run verify-live -- <url>` |
| **`wayback-client.ts`** | Internet Archive snapshot lookup & counts | Wayback Availability & CDX APIs | `inspector.ts`, `url-tracker.ts` | `npm run wayback -- <url>` |
| **`wikipedia-client.ts`** | External citation discovery in Wikipedia articles | MediaWiki API (`exturlusage`) | `url-tracker.ts`, `server.ts` | `npm run wiki -- <url>` |
| **`url-tracker.ts`** | Dual-source batch orchestrator & risk classification | `wikipedia-client`, `crawler`, `live-verifier`, `wayback-client` | `server.ts`, UI (`UrlTracker.tsx`) | `npm run track -- <urls...>` |
| **`inspector.ts`** | Single-URL composite inspection & recommendation | `live-verifier`, `wayback-client` | `server.ts`, UI (`UrlInspector.tsx`) | `npm run inspect -- <url>` |
| **`server.ts`** | Local HTTP REST API & static asset hosting | All `src/` modules | Frontend client (`api.ts`), CLI tools | `npm run server` |

---

## 5. Classification Logic & Risk Scoring Engine

The platform uses a multi-factor risk matrix to classify hyperlinks:

```mermaid
flowchart TD
    Target(["Target Hyperlink"]) --> CheckWiki{"Cited in Wikipedia articles?<br/>(MediaWiki exturlusage)"}

    CheckWiki -- Yes --> CheckLiveWiki{"Is destination URL alive?<br/>(Live HTTP 200 / 304 OK)"}
    CheckWiki -- No --> CheckLiveNoWiki{"Is destination URL alive?<br/>(Live HTTP 200 / 304 OK)"}

    CheckLiveWiki -- Yes --> HealthyWiki["HEALTHY (Low Risk)<br/>• Verified active citation on Wikipedia & Web"]
    CheckLiveWiki -- No --> CriticalWiki["CRITICAL (Wikipedia Dead Link)<br/>• Active Wikipedia citation is dead / unreachable<br/>• Immediate Wayback fallback replacement needed"]

    CheckLiveNoWiki -- Yes --> CheckCrawlAlive{"Rotted in past Common Crawl?"}
    CheckLiveNoWiki -- No --> CheckCrawlDead{"Absent or rotted in Common Crawl?"}

    CheckCrawlAlive -- Yes --> MediumRisk["MEDIUM RISK (Recovered)<br/>• Active live today despite past crawl omissions"]
    CheckCrawlAlive -- No --> LowRisk["LOW RISK (Healthy / Active)<br/>• Live and persistent across web history"]

    CheckCrawlDead -- Yes --> HighRisk["HIGH RISK (Confirmed Web Decay)<br/>• Dead on live probe and rotted across crawl archives"]
    CheckCrawlDead -- No --> MediumUnreach["MEDIUM RISK (Unreachable)<br/>• Live check failed or origin blocked"]
```

### Risk Tier Definitions

1. **`CRITICAL` (Wikipedia Dead Link Risk)**:
   - **Condition**: Cited as an external reference on one or more Wikipedia pages, but returns `404 Not Found`, connection reset, or HTTP error on real-time verification.
   - **Action**: Immediate archival fallback replacement recommended.
2. **`HIGH` (Confirmed Web Decay)**:
   - **Condition**: Dead on live HTTP verification and absent or rotted across historical Common Crawl snapshots.
3. **`MEDIUM` (Recovered / Historical Crawl Omission)**:
   - **Condition**: Absent or errored in historical crawl archives, but currently responding `200 OK` on live probing.
4. **`LOW` (Verified Active)**:
   - **Condition**: Responding with valid `200 OK` or `304 Not Modified` headers on live probe.

---

## 6. Data Flow Diagrams

### Complete System Data Flow

```mermaid
flowchart TD
    subgraph DataSources["External Data Sources"]
        CC_CDX["Common Crawl CDX APIs<br/>(index.commoncrawl.org)"]
        MediaWiki["Wikipedia MediaWiki API<br/>(en.wikipedia.org/w/api.php)"]
        LiveWeb["Live Target Origin Servers<br/>(HTTP HEAD / GET)"]
        WaybackAPI["Internet Archive APIs<br/>(archive.org/wayback)"]
    end

    subgraph Processing["Processing & Analytics"]
        Sampler["Baseline Sampler<br/>(crawler.ts)"]
        Engine["Persistence Engine<br/>(analyzer.ts)"]
        BatchTracker["Batch URL Tracker<br/>(url-tracker.ts)"]
        LiveEngine["Live Verifier<br/>(live-verifier.ts)"]
    end

    subgraph Storage["Persistent Storage & Memory"]
        JSON_Sample[("historical_sample.json")]
        JSON_Analysis[("link_rot_analysis.json")]
        MemCache["In-Memory Cache"]
    end

    subgraph Presentation["Presentation & Export Layer"]
        RestAPI["REST API Endpoints (/api/*)"]
        ReactUI["Vite + React Dashboard"]
        Exports["JSON & CSV Exports"]
    end

    CC_CDX --> Sampler --> JSON_Sample --> Engine
    CC_CDX --> Engine --> JSON_Analysis --> MemCache --> RestAPI
    MediaWiki & LiveWeb & WaybackAPI --> BatchTracker --> RestAPI
    LiveWeb --> LiveEngine --> RestAPI

    RestAPI --> ReactUI --> Exports
```

---

## 7. Summary

The Link Rot Analyzer bridges **macro web preservation research** with **tactical citation auditing**:
- **Independent**: Any component can be executed as a standalone CLI script (`npm run <module>`).
- **Decoupled**: Heavy historical data loading does not block real-time URL tracking or inspection.
- **Accurate**: Combining historical crawl indexes with real-time HTTP verification eliminates false positives from transient crawl omissions.
- **Actionable**: Identifies specific broken citations on Wikipedia and provides immediate Internet Archive Wayback Machine fallback links.
