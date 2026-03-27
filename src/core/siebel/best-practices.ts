/**
 * Siebel Best Practices Knowledge Base — 50+ rules categorized by object type.
 * Each rule has correct/incorrect examples and severity.
 */

import { logger } from "../utils/logger.js";

export interface BestPracticeRule {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly severity: "error" | "warning" | "info";
  readonly correct: string;
  readonly incorrect: string;
}

// --- Rules ---

const RULES: BestPracticeRule[] = [
  // NAMING (10)
  { id: "NAM-001", category: "naming", title: "Use project prefix", description: "All custom objects must use the project-specific prefix", severity: "error", correct: "CX_Account BC", incorrect: "Account BC" },
  { id: "NAM-002", category: "naming", title: "BC suffix", description: "Business Components must end with ' BC'", severity: "warning", correct: "CX Account BC", incorrect: "CX Account BusComp" },
  { id: "NAM-003", category: "naming", title: "Applet suffix with style", description: "Applets must end with 'List Applet' or 'Form Applet'", severity: "warning", correct: "CX Account List Applet", incorrect: "CX Account Applet1" },
  { id: "NAM-004", category: "naming", title: "View suffix", description: "Views must end with ' View'", severity: "warning", correct: "CX Account Detail View", incorrect: "CX Account Screen1" },
  { id: "NAM-005", category: "naming", title: "IO suffix", description: "Integration Objects must end with ' IO'", severity: "warning", correct: "CX Account IO", incorrect: "CX Account Integration" },
  { id: "NAM-006", category: "naming", title: "No spaces in table names", description: "Custom table names use underscores", severity: "error", correct: "CX_S_ACCOUNT", incorrect: "CX S ACCOUNT" },
  { id: "NAM-007", category: "naming", title: "Field naming consistency", description: "Fields use PascalCase or match base table columns", severity: "info", correct: "Account Name", incorrect: "account_name_field" },
  { id: "NAM-008", category: "naming", title: "BO naming matches entity", description: "BO name should match the primary entity", severity: "info", correct: "CX Account BO", incorrect: "CX AcctMgmt BO" },
  { id: "NAM-009", category: "naming", title: "Screen naming", description: "Screen name should match the main entity", severity: "info", correct: "CX Account Screen", incorrect: "CX Screen 1" },
  { id: "NAM-010", category: "naming", title: "Link naming", description: "Link names describe the relationship", severity: "info", correct: "Account/Contact", incorrect: "Link1" },

  // CONFIGURATION (15)
  { id: "CFG-001", category: "configuration", title: "BC must have TABLE", description: "Every BC must define the TABLE property", severity: "error", correct: "TABLE = S_ORG_EXT", incorrect: "TABLE = (empty)" },
  { id: "CFG-002", category: "configuration", title: "Applet must have BUS_COMP", description: "Every Applet must reference a BC", severity: "error", correct: "BUS_COMP = CX Account BC", incorrect: "BUS_COMP = (empty)" },
  { id: "CFG-003", category: "configuration", title: "View must have BO", description: "Every View must reference a Business Object", severity: "error", correct: "BUS_OBJECT = CX Account BO", incorrect: "BUS_OBJECT = (empty)" },
  { id: "CFG-004", category: "configuration", title: "No INACTIVE test objects in prod", description: "Objects with Test/Debug/Temp in name must be INACTIVE=Y", severity: "warning", correct: "INACTIVE = Y for test objects", incorrect: "INACTIVE = N for 'CX Test Applet'" },
  { id: "CFG-005", category: "configuration", title: "SORT_SPEC for list applets", description: "List applets should have a SORT_SPEC on the BC", severity: "info", correct: "SORT_SPEC = Name (ASC)", incorrect: "SORT_SPEC = (empty)" },
  { id: "CFG-006", category: "configuration", title: "SEARCH_SPEC for filtered BCs", description: "BCs with pre-filtering should define SEARCH_SPEC", severity: "info", correct: "SEARCH_SPEC = [Status] = 'Active'", incorrect: "No SearchSpec on filtered BC" },
  { id: "CFG-007", category: "configuration", title: "User Properties documented", description: "Custom User Properties should have descriptive names", severity: "info", correct: "Named Search: My Custom Search", incorrect: "User Prop 1" },
  { id: "CFG-008", category: "configuration", title: "Web Template exists", description: "Applet web template must reference existing template", severity: "error", correct: "WEB_TEMPLATE = Applet Form", incorrect: "WEB_TEMPLATE = (non-existent)" },
  { id: "CFG-009", category: "configuration", title: "Link source/dest fields valid", description: "Link SOURCE_FIELD and DEST_FIELD must exist in respective BCs", severity: "error", correct: "SOURCE_FIELD = Id, DEST_FIELD = Account Id", incorrect: "SOURCE_FIELD = NonExistent" },
  { id: "CFG-010", category: "configuration", title: "IO fields have DATA_TYPE", description: "IC Fields must have DATA_TYPE defined", severity: "warning", correct: "DATA_TYPE = DTYPE_TEXT", incorrect: "DATA_TYPE = (empty)" },
  { id: "CFG-011", category: "configuration", title: "IO User Keys defined", description: "Integration Objects should define User Keys for upsert matching", severity: "warning", correct: "User Key on Account Id field", incorrect: "No User Keys on IO" },
  { id: "CFG-012", category: "configuration", title: "No duplicate field names", description: "BC should not have duplicate field names", severity: "error", correct: "Unique field names", incorrect: "Two fields named 'Status'" },
  { id: "CFG-013", category: "configuration", title: "Control FIELD property set", description: "Applet controls must reference a BC field via FIELD property", severity: "warning", correct: "FIELD = Account Name", incorrect: "FIELD = (empty)" },
  { id: "CFG-014", category: "configuration", title: "View applet references valid", description: "View must reference applets that exist", severity: "error", correct: "Applet ref to existing CX Account List Applet", incorrect: "Applet ref to non-existent applet" },
  { id: "CFG-015", category: "configuration", title: "No circular BC links", description: "BC link chains should not create circular references", severity: "error", correct: "Account -> Contact -> Address (linear)", incorrect: "Account -> Contact -> Account (circular)" },

  // SCRIPTING (15)
  { id: "SCR-001", category: "scripting", title: "try/catch/finally required", description: "Every event handler must use try/catch/finally", severity: "error", correct: "try { ... } catch(e) { RaiseErrorText(e) } finally { cleanup }", incorrect: "No try/catch in event handler" },
  { id: "SCR-002", category: "scripting", title: "Memory cleanup in finally", description: "Set all Siebel objects to null in finally block", severity: "error", correct: "finally { bc = null; bs = null; }", incorrect: "No null assignments in finally" },
  { id: "SCR-003", category: "scripting", title: "ActivateField before query", description: "Call ActivateField for every field read before ExecuteQuery", severity: "warning", correct: "bc.ActivateField('Name'); bc.ExecuteQuery()", incorrect: "bc.ExecuteQuery(); bc.GetFieldValue('Name')" },
  { id: "SCR-004", category: "scripting", title: "ForwardOnly queries", description: "Use ExecuteQuery(ForwardOnly) for read-only iteration", severity: "warning", correct: "bc.ExecuteQuery(ForwardOnly)", incorrect: "bc.ExecuteQuery()" },
  { id: "SCR-005", category: "scripting", title: "No empty catch blocks", description: "Catch blocks must handle the error, not swallow it", severity: "error", correct: "catch(e) { TheApplication().RaiseErrorText(e.toString()) }", incorrect: "catch(e) { }" },
  { id: "SCR-006", category: "scripting", title: "No hardcoded URLs", description: "Use system preferences or ProfileAttr for URLs", severity: "warning", correct: "GetProfileAttr('IntegrationURL')", incorrect: "var url = 'http://prod.example.com'" },
  { id: "SCR-007", category: "scripting", title: "No hardcoded IPs", description: "Never hardcode IP addresses in scripts", severity: "warning", correct: "Use DNS name via config", incorrect: "var host = '10.0.1.100'" },
  { id: "SCR-008", category: "scripting", title: "Cache LOV lookups", description: "Cache LookupValue results in variables outside loops", severity: "warning", correct: "var cached = LookupValue(...); for(...) use cached", incorrect: "for(...) { LookupValue(...) inside loop }" },
  { id: "SCR-009", category: "scripting", title: "Use var keyword", description: "Always declare variables with var keyword", severity: "warning", correct: "var sName = bc.GetFieldValue('Name')", incorrect: "sName = bc.GetFieldValue('Name')" },
  { id: "SCR-010", category: "scripting", title: "RaiseErrorText for user errors", description: "Use RaiseErrorText to display errors to user", severity: "info", correct: "TheApplication().RaiseErrorText(sMsg)", incorrect: "alert(sMsg)" },
  { id: "SCR-011", category: "scripting", title: "No dead code", description: "Remove commented-out code blocks marked as dead", severity: "info", correct: "Clean code without dead blocks", incorrect: "/* Dead Code */ var old = ... /* End Dead Code */" },
  { id: "SCR-012", category: "scripting", title: "Document ProfileAttr usage", description: "Every SetProfileAttr should have a corresponding GetProfileAttr", severity: "info", correct: "Set in View A, Get in View B (documented)", incorrect: "SetProfileAttr with no consumer" },
  { id: "SCR-013", category: "scripting", title: "Consistent return values", description: "Event handlers must return CancelOperation or ContinueOperation", severity: "warning", correct: "return CancelOperation; ... return ContinueOperation;", incorrect: "No return statement" },
  { id: "SCR-014", category: "scripting", title: "No GetFieldValue in loops without ActivateField", description: "Activate fields before entering record iteration loops", severity: "warning", correct: "ActivateField before while(bc.NextRecord())", incorrect: "GetFieldValue inside loop without ActivateField" },
  { id: "SCR-015", category: "scripting", title: "Use typed error messages", description: "Include error code and context in error messages", severity: "info", correct: "RaiseErrorText('ERR-001: Account not found: ' + sId)", incorrect: "RaiseErrorText('Error')" },

  // BUSINESS_COMPONENT (5)
  { id: "BC-001", category: "business_component", title: "Define primary field", description: "BC should have a clear primary/display field", severity: "info", correct: "Name field as primary display", incorrect: "No identifiable display field" },
  { id: "BC-002", category: "business_component", title: "Limit field count", description: "BC with 100+ fields may indicate need for decomposition", severity: "warning", correct: "BC with focused field set (< 50)", incorrect: "BC with 150+ fields" },
  { id: "BC-003", category: "business_component", title: "Link cardinality", description: "Define link cardinality (1:1, 1:M) correctly", severity: "warning", correct: "1:M link from Account to Contact", incorrect: "Missing cardinality definition" },
  { id: "BC-004", category: "business_component", title: "SearchSpec SQL injection", description: "SearchSpec values must be parameterized, not concatenated", severity: "error", correct: "SetSearchSpec('Name', sInput)", incorrect: "SearchSpec = \"[Name] = '\" + sInput + \"'\"" },
  { id: "BC-005", category: "business_component", title: "ViewMode awareness", description: "Set correct ViewMode before queries", severity: "warning", correct: "bc.SetViewMode(AllView) for admin queries", incorrect: "Default ViewMode for cross-org queries" },

  // APPLET (5)
  { id: "APL-001", category: "applet", title: "Control-to-field mapping", description: "Every visible control must map to a BC field", severity: "error", correct: "Control FIELD = Account Name", incorrect: "Control with no FIELD mapping" },
  { id: "APL-002", category: "applet", title: "List applet column limit", description: "List applets should show 5-10 columns max", severity: "info", correct: "7 columns in list applet", incorrect: "25 columns in list applet" },
  { id: "APL-003", category: "applet", title: "Form applet section grouping", description: "Form applets should group related fields in sections", severity: "info", correct: "Sections: Basic Info, Address, Contact", incorrect: "All 30 fields in one flat form" },
  { id: "APL-004", category: "applet", title: "Toggles and buttons named clearly", description: "Action buttons should have descriptive labels", severity: "info", correct: "Button: Submit Order", incorrect: "Button: Button1" },
  { id: "APL-005", category: "applet", title: "No duplicate controls", description: "Applet should not have duplicate controls for same field", severity: "warning", correct: "One control per field", incorrect: "Two controls mapping to 'Name'" },

  // INTEGRATION (5)
  { id: "INT-001", category: "integration", title: "IO matches WSDL contract", description: "IO fields must match the WSDL complex type fields", severity: "error", correct: "IO fields align with WSDL types", incorrect: "IO has extra/missing fields vs WSDL" },
  { id: "INT-002", category: "integration", title: "Error fields present", description: "IO should include Error_spcCode and Error_spcMessage fields", severity: "warning", correct: "Error_spcCode and Error_spcMessage IC Fields", incorrect: "No error handling fields" },
  { id: "INT-003", category: "integration", title: "Inbound operations use upsert", description: "Inbound sync operations should use upsert pattern", severity: "info", correct: "UpsertAccount operation", incorrect: "Separate Insert + Update operations" },
  { id: "INT-004", category: "integration", title: "Outbound retry logic", description: "Outbound calls should implement retry for transient failures", severity: "warning", correct: "Retry with exponential backoff", incorrect: "Single call, fail on timeout" },
  { id: "INT-005", category: "integration", title: "Contract versioning", description: "Use version suffix when evolving contracts", severity: "info", correct: "AccountServiceV3", incorrect: "AccountService (ambiguous version)" },

  // SECURITY (5)
  { id: "SEC-001", category: "security", title: "No sensitive data in scripts", description: "Never store passwords, tokens, or PII in scripts", severity: "error", correct: "Use system preferences for credentials", incorrect: "var password = 'secret123'" },
  { id: "SEC-002", category: "security", title: "LGPD compliance for PII fields", description: "PII fields (CPF, email, phone) must be flagged for data protection", severity: "error", correct: "PII fields marked with privacy metadata", incorrect: "CPF field with no privacy controls" },
  { id: "SEC-003", category: "security", title: "No DeleteRecord in applet scripts", description: "Avoid DeleteRecord in applet scripts — use BC-level or workflow", severity: "warning", correct: "Delete via workflow with audit", incorrect: "bc.DeleteRecord() in applet script" },
  { id: "SEC-004", category: "security", title: "Validate input in inbound services", description: "Validate all input fields in inbound web service handlers", severity: "error", correct: "Check required fields, validate types", incorrect: "Pass input directly to BC without validation" },
  { id: "SEC-005", category: "security", title: "Audit trail for sensitive operations", description: "Log sensitive operations (delete, update PII, export)", severity: "warning", correct: "TheApplication().Trace() for audit", incorrect: "No logging of sensitive operations" },
];

// --- Public API ---

export function getSiebelBestPractices(): readonly BestPracticeRule[] {
  logger.debug("best-practices: returning all rules", { count: RULES.length });
  return RULES;
}

export function getBestPracticesByCategory(): Record<string, readonly BestPracticeRule[]> {
  const categories: Record<string, BestPracticeRule[]> = {};
  for (const rule of RULES) {
    if (!categories[rule.category]) {
      categories[rule.category] = [];
    }
    categories[rule.category].push(rule);
  }
  logger.debug("best-practices: by category", { categories: Object.keys(categories).length });
  return categories;
}
