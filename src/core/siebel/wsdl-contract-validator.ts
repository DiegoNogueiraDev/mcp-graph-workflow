/**
 * WSDL Contract Validator — validates WSDL fields against Siebel BC fields.
 * Reports orphan fields, missing fields, and conformance scores per operation.
 */

import type { WsdlParseResult, WsdlComplexType } from "./wsdl-parser.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

export interface OperationValidation {
  operationName: string;
  serviceName: string;
  wsdlFieldCount: number;
  matchedFields: string[];
  orphanFields: string[];
  missingFields: string[];
  conformanceScore: number;
}

export interface ContractValidationResult {
  operations: OperationValidation[];
  overallScore: number;
}

/**
 * Collect all field names from BC children (type="field" or any child).
 */
function collectBcFieldNames(bcs: SiebelObject[]): Set<string> {
  const names = new Set<string>();
  for (const bc of bcs) {
    for (const child of bc.children) {
      names.add(child.name);
    }
  }
  return names;
}

/**
 * Collect all field names from WSDL types used by an operation (input + output).
 */
function collectWsdlFieldNames(
  inputType: string,
  outputType: string,
  typeMap: Map<string, WsdlComplexType>,
): string[] {
  const fields = new Set<string>();

  for (const typeName of [inputType, outputType]) {
    const complexType = typeMap.get(typeName);
    if (complexType) {
      for (const field of complexType.fields) {
        fields.add(field.name);
      }
    }
  }

  return [...fields];
}

/**
 * Validate WSDL contract against Siebel BC fields.
 * Reports matched, orphan (in WSDL but not BC), and missing (in BC but not WSDL) fields.
 */
export function validateWsdlContract(
  wsdl: WsdlParseResult,
  bcs: SiebelObject[],
): ContractValidationResult {
  const bcFieldNames = collectBcFieldNames(bcs);
  const typeMap = new Map(wsdl.types.map((t) => [t.name, t]));
  const serviceName = wsdl.services[0]?.name ?? "Unknown";

  const operations: OperationValidation[] = [];

  for (const op of wsdl.operations) {
    const wsdlFields = collectWsdlFieldNames(op.inputMessage, op.outputMessage, typeMap);

    const matched: string[] = [];
    const orphan: string[] = [];

    for (const field of wsdlFields) {
      if (bcFieldNames.has(field)) {
        matched.push(field);
      } else {
        orphan.push(field);
      }
    }

    // Fields in BC but not referenced by this operation's WSDL types
    const wsdlFieldSet = new Set(wsdlFields);
    const missing = [...bcFieldNames].filter((f) => !wsdlFieldSet.has(f));

    const conformanceScore = wsdlFields.length > 0
      ? Math.round((matched.length / wsdlFields.length) * 100)
      : 0;

    operations.push({
      operationName: op.name,
      serviceName,
      wsdlFieldCount: wsdlFields.length,
      matchedFields: matched,
      orphanFields: orphan,
      missingFields: missing,
      conformanceScore,
    });
  }

  const overallScore = operations.length > 0
    ? Math.round(operations.reduce((sum, o) => sum + o.conformanceScore, 0) / operations.length)
    : 100;

  logger.info("WSDL contract validation complete", {
    serviceName,
    operationCount: String(operations.length),
    overallScore: String(overallScore),
  });

  return { operations, overallScore };
}
