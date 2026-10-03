/**
 * @fileoverview Universal Markdown frontmatter parser and serializer for OKF concept documents.
 *
 * Implements parsing and serialization between raw markdown files (with YAML frontmatter)
 * and typed {@link Concept} objects using `gray-matter`.
 *
 * @packageDocumentation
 */

import matter from 'gray-matter';
import { Concept, FrontmatterSchema, normalizeVerified } from './schema.js';

/**
 * Outcome of parsing a markdown document for OKF frontmatter and body.
 */
export interface ParseResult {
  /** Indicates whether the document was successfully parsed and conformed to OKF schemas. */
  valid: boolean;
  /** The resulting {@link Concept} object if parsing was successful. */
  concept?: Concept;
  /** List of validation or syntax error messages if parsing failed. */
  errors?: string[];
}

/**
 * Interface defining contract for parsing raw markdown into concepts and serializing concepts back to markdown.
 */
export interface Parser {
  /**
   * Parses raw markdown string into a validated {@link ParseResult}.
   *
   * @param content - The raw markdown file text including YAML frontmatter.
   * @param filepath - Optional file path used for deriving the concept ID.
   * @returns The parsing outcome and concept object if valid.
   */
  parse(content: string, filepath?: string): ParseResult;

  /**
   * Serializes an OKF concept document back to a markdown string with YAML frontmatter.
   *
   * @param concept - The concept document to stringify.
   * @returns Formatted markdown string with YAML frontmatter delimiter block.
   */
  stringify(concept: Concept): string;
}

/**
 * Default implementation of {@link Parser} utilizing `gray-matter` for YAML parsing and serialization.
 */
export class GrayMatterParser implements Parser {
  /**
   * Parses raw markdown document content, validates frontmatter against {@link FrontmatterSchema},
   * and normalizes verification fields.
   *
   * @param content - Raw markdown text with YAML frontmatter.
   * @param filepath - Document path (defaults to `'inline.md'`).
   * @returns {@link ParseResult} containing the concept if valid, or error diagnostics.
   *
   * @example
   * ```ts
   * const parser = new GrayMatterParser();
   * const result = parser.parse('---\ntype: concept\ntitle: Hello\n---\nBody text', 'hello.md');
   * if (result.valid) {
   *   console.log(result.concept?.id); // 'hello'
   * }
   * ```
   */
  parse(content: string, filepath: string = 'inline.md'): ParseResult {
    try {
      const parsed = matter(content);
      const validation = FrontmatterSchema.safeParse(parsed.data);

      if (!validation.success) {
        return {
          valid: false,
          errors: validation.error.issues.map(
            (e) => `${e.path.join('.')}: ${e.message}`
          ),
        };
      }

      const frontmatter = { ...validation.data };
      if (frontmatter.verified !== undefined) {
        frontmatter.verified = normalizeVerified(frontmatter.verified);
      }

      const conceptId = filepath.endsWith('.md')
        ? filepath.slice(0, -3)
        : filepath;

      return {
        valid: true,
        concept: {
          id: conceptId,
          filepath,
          frontmatter,
          body: parsed.content.trim(),
        },
      };
    } catch (err: unknown) {
      return {
        valid: false,
        errors: [
          (err as Error).message || 'Failed to parse markdown frontmatter',
        ],
      };
    }
  }

  /**
   * Serializes a {@link Concept} object into a markdown string containing YAML frontmatter.
   *
   * @param concept - Concept object to serialize.
   * @returns Raw markdown text with frontmatter header.
   *
   * @example
   * ```ts
   * const raw = parser.stringify(concept);
   * ```
   */
  stringify(concept: Concept): string {
    return matter.stringify(concept.body, concept.frontmatter);
  }
}

const defaultParser = new GrayMatterParser();

/**
 * Convenient standalone function to parse raw concept markdown text using the default {@link GrayMatterParser}.
 *
 * @param content - Raw markdown text with frontmatter.
 * @param filepath - Optional file path identifier (defaults to `'inline.md'`).
 * @returns Resulting {@link ParseResult}.
 *
 * @example
 * ```ts
 * const res = parseConceptContent('---\ntype: concept\n---\n# Title');
 * ```
 */
export function parseConceptContent(
  content: string,
  filepath: string = 'inline.md'
): ParseResult {
  return defaultParser.parse(content, filepath);
}

/**
 * Convenient standalone function to serialize a {@link Concept} into a markdown string using the default parser.
 *
 * @param concept - The concept object to serialize.
 * @returns Serialized markdown text with YAML frontmatter.
 */
export function stringifyConcept(concept: Concept): string {
  return defaultParser.stringify(concept);
}

/** Backward compatibility alias for {@link ParseResult}. */
export type OKFParseResult = ParseResult;

/** Backward compatibility alias for {@link Parser}. */
export type OKFParser = Parser;
