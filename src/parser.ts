import matter from 'gray-matter';
import { Concept, FrontmatterSchema, normalizeVerified } from './schema.js';

export interface ParseResult {
  valid: boolean;
  concept?: Concept;
  errors?: string[];
}

export interface Parser {
  parse(content: string, filepath?: string): ParseResult;
  stringify(concept: Concept): string;
}

export class GrayMatterParser implements Parser {
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

  stringify(concept: Concept): string {
    return matter.stringify(concept.body, concept.frontmatter);
  }
}

const defaultParser = new GrayMatterParser();

export function parseConceptContent(
  content: string,
  filepath: string = 'inline.md'
): ParseResult {
  return defaultParser.parse(content, filepath);
}

export function stringifyConcept(concept: Concept): string {
  return defaultParser.stringify(concept);
}

// Backward Compatibility Aliases
export type OKFParseResult = ParseResult;
export type OKFParser = Parser;
