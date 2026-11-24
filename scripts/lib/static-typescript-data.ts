import { readFileSync } from "node:fs";
import ts from "typescript";

export type StaticLiteral =
  | null
  | boolean
  | number
  | string
  | StaticLiteral[]
  | { [key: string]: StaticLiteral };

export function readStaticExportedArray(
  filePath: string,
  exportName: string,
): Array<Record<string, unknown>> {
  const sourceText = readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (
      !statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (declaration.name.text !== exportName || !declaration.initializer)
        continue;
      const value = evaluateStatic(declaration.initializer);
      if (!Array.isArray(value))
        throw new Error("static.export.not_array:" + exportName);
      return value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      );
    }
  }
  throw new Error("static.export.not_found:" + exportName + ":" + filePath);
}

function evaluateStatic(node: ts.Expression): StaticLiteral | undefined {
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  )
    return evaluateStatic(node.expression);

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;

  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  ) {
    const inner = evaluateStatic(node.operand);
    return typeof inner === "number" ? -inner : undefined;
  }

  if (ts.isArrayLiteralExpression(node))
    return node.elements.flatMap((element) => {
      if (ts.isSpreadElement(element)) return [];
      const value = evaluateStatic(element as ts.Expression);
      return value === undefined ? [] : [value];
    });

  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, StaticLiteral> = {};
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyName(property.name);
      if (!key) continue;
      const value = evaluateStatic(property.initializer);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  // A small number of upstream completion files wrap literal records in a
  // one-argument helper such as loc({...}). Reading the literal argument is
  // safe; the helper itself is never executed.
  if (ts.isCallExpression(node) && node.arguments.length === 1) {
    const only = node.arguments[0];
    if (only) return evaluateStatic(only);
  }

  return undefined;
}

function propertyName(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text;
  return null;
}
