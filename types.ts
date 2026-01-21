// =============================================================================
// AUCTORIAN KERNEL TYPES (v10.19 - PlanSmart Architecture)
// =============================================================================

// --- 1. CORE ARCHITECTURE ENUMS ---

export enum Plane {
  DATA = 'Data Plane',
  ORCHESTRATION = 'Decision Orchestration Plane',
  GOVERNANCE = 'Governance & Trust Plane',
  EXECUTION = 'Execution Plane',
  INTELLIGENCE = 'Intelligence Plane'
}

export enum TriageLevel {
  SYSTEM_0 = 'System 0 (Baseline/No-Action)',
  SYSTEM_1 = 'System 1 (Reflexive/Heuristic)',
  SYSTEM_2 = 'System 2 (Deliberative Reasoning)'
}

export enum DecisionStatus {
  DRAFT = 'Draft',
  TRIAGING = 'Triaging',
  BOARDROOM_DEBATE = 'Boardroom Debate',
  PENDING_APPROVAL = 'Pending Approval',
  APPROVED = 'Approved',
  EXECUTED = 'Executed',
  REJECTED = 'Rejected',
  DEADLOCK = 'Deadlock (Status Quo Bias Applied)',
  AUTO_REJECT = 'Auto-Reject (Policy Violation)'
}

// --- 2. DATA PLANE TYPES (Ingestion & Contracts) ---

export type DatasetType = 'Product' | 'Sales' | 'Inventory' | 'Store' | 'Unknown';

export interface DataContract {
  id: string;
  datasetName: string;
  source: string;
  frequency: string;
  lastIngested: string;
  status: 'Healthy' | 'Critical' | 'Warning';
  qualityScore: number;
  schemaValid: boolean;
  rowCount: number;
  detectedType: 'EVENT' | 'OBJECT';
}

// --- 3. CARTRIDGE & ONTOLOGY TYPES ---

export interface DataSchemaField {
  id: string;
  type: 'MASTER' | 'TRANSACTION';
  mandatoryFields: string[];
}

export interface Vocabulary {
  product: string;
  location: string;
  transaction: string;
}

export interface CartridgeManifest {
  id: string;
  name: string;
  version: string;
  vocabulary: Vocabulary;
  dataSchema: DataSchemaField[];
  policies: any[];
  prompts: any[];
  status?: 'ACTIVE' | 'INSTALLED' | 'AVAILABLE';
  // The entities this cartridge supports (e.g. ['PRODUCT', 'TRANSACTION'])
  supportedEntities: string[];
  icon?: any;  // Added for UI rendering
  description?: string; // Added for UI rendering
}

export interface EnterpriseConfig {
  hierarchy: { id: string; label: string; isPlanningEnabled: boolean }[];
  timeBuckets: string[];
}

// --- 4. LEGACY PLANNING TYPES (For Dashboards/Summaries) ---
// Kept for backward compatibility with older views

export interface MetricValue {
  WP: number; // Working Plan
  LY: number; // Last Year
  OP: number; // Original Plan (Budget)
}

export interface PlanningRow {
  id: string;
  hierarchy: {
    division?: string;
    dept?: string;
    class_name?: string;
    [key: string]: any;
  };
  decision?: string;
  rationale?: string;
  metrics: {
    sales_amt: MetricValue;
    sales_units: MetricValue;
    gm_pct: MetricValue;
    aur: MetricValue;
    inventory: MetricValue;
    wos: MetricValue;
    receipts: MetricValue;
  };
}

// =============================================================================
// 5. PLANSMART GRID TYPES (New 5-Year Architecture)
// =============================================================================

// The specific versions available in the grid
export type VersionType = 'wp' | 'op' | 'ly' | 'actual';

// The Atomic Cell Unit (Supports "Lock & Hold")
export interface FinancialCell {
  value: number;
  locked: boolean;      // If true, this value anchors calculations
  derived?: boolean;    // If true, this was calculated (read-only style)
  history?: number;     // For audit trails / undo
}

// A collection of versions for a single metric (e.g., Sales Units)
export type VersionSet = Record<VersionType, FinancialCell>;

// All metrics for a specific Time Bucket (e.g., "Jan 2026")
export interface PeriodData {
  periodId: string;     // e.g. "2026-01"
  sales_units: VersionSet;
  sales_amt: VersionSet;
  aur: VersionSet;      // Average Unit Retail (Price)
  receipts: VersionSet; // Open-to-Buy
  inventory: VersionSet;// Ending Inventory (EOP)
}

// The Recursive Tree Node (The Backbone of the Grid)
export interface PlanNode {
  id: string;           // Unique ID (e.g., "DIV-Footwear")
  name: string;         // Display Name (e.g., "Footwear")
  level: string;        // Ontology Level (e.g., "Division")

  // The Data Cube: Key = Period ID (e.g., "2026-01") -> Value = Metrics
  data: Record<string, PeriodData>;

  // Hierarchy
  children: PlanNode[];
  isExpanded?: boolean; // UI State
  parentId?: string | null;
}

// Configuration Context for the Grid
export interface PlanningContext {
  anchorLevel: string;      // The level being edited (e.g., Category)
  aggregateLevel: string;   // The grouping level (e.g., Division)
  timeBucket: 'Week' | 'Month';
  startYear: number;
  horizonYears: number;     // e.g., 5
}

// --- 6. INTELLIGENCE & UTILITY TYPES ---

export interface PlanningScope {
  anchorLevel: string;
  timeHorizon: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: React.ElementType;
  color?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue';
}

export interface ForecastResult {
  sku: string;
  forecast: { date: string; value: number; lower: number; upper: number }[];
  confidence: number;
}

// =============================================================================
// 7. CONSTITUTIONAL SCHEMA TYPES (Auctorian DNA)
// =============================================================================

export enum ConstitutionalFamily {
  INTRINSIC = "INTRINSIC",       // What it IS (Brand, Category)
  STATE = "STATE",               // What it HAS (Price, Inventory)
  PERFORMANCE = "PERFORMANCE",   // What it DID (Sales, Margin)
  ENVIRONMENTAL = "ENVIRONMENTAL" // What happened TO it (Weather, Comp Price)
}

export interface SchemaField {
  // SOURCE (Client)
  source_column_name: string;
  source_column_datatype: string;

  // GENERIC (Auctorian Standard)
  generic_column_name: string;          // The canonical name (e.g. 'product_id')
  generic_column_datatype: string;
  display_name: string;

  // CONSTRAINTS & PHYSICS
  is_pk: boolean;                       // Primary Key
  is_hierarchy: boolean;                // Part of the graph structure
  hierarchy_level?: number;             // 1 = Highest (Division), 5 = Lowest (SKU)
  is_attribute: boolean;                // Descriptive feature
  is_partition_col: boolean;            // For BigQuery/Snowflake partitioning
  is_clustering_col: boolean;           // For query optimization
  is_null_allowed: boolean;
  unique_by?: string;

  // LOGIC
  required_in_product: boolean;        // Is this field mandatory for the cartridge?
  formula?: string;                     // Synthetic feature logic

  // LEGACY (for backward compatibility)
  name?: string;                        // Alias for source_column_name
  generic_anchor?: string;              // Old anchor system
  family_type?: ConstitutionalFamily;  // Old family classification
}

export interface AnchorDefinition {
  anchor: string;                  // e.g., 'ANCHOR_RETAIL_PRICE'
  label: string;                   // Display name: 'Retail Price'
  family: ConstitutionalFamily;
  mandatory: boolean;
  description: string;
  unlocks?: string;                // Gamification: 'Revenue Physics'
}
