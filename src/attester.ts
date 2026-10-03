/**
 * @fileoverview Evaluator and verifier for OKF "Attested Computation" concepts.
 *
 * Inspects concept frontmatter to validate that executable computation contracts
 * and attestation commands are properly configured.
 *
 * @packageDocumentation
 */

import { Concept } from './schema.js';

/**
 * Result of evaluating an Attested Computation concept.
 */
export interface AttestationResult {
  /** Indicates whether the concept satisfies all Attested Computation requirements. */
  passed: boolean;
  /** Identifier of the concept evaluated. */
  conceptId: string;
  /** Configured executor runner type (e.g. `'shell'`, `'docker'`). */
  executorType?: string;
  /** Executable command string extracted from the concept's executor configuration. */
  command?: string;
  /** Human-readable status or diagnostic explanation message. */
  message: string;
}

/**
 * Evaluates whether an OKF concept qualifies as an Attested Computation and verifies its execution configuration.
 *
 * Requires `frontmatter.type === 'Attested Computation'` and a non-empty `frontmatter.executor.run` command.
 *
 * @param concept - Concept document to evaluate.
 * @returns An {@link AttestationResult} recording success or failure details.
 *
 * @example
 * ```ts
 * const result = evaluateAttestedComputation(concept);
 * if (result.passed) {
 *   console.log(`Execution command: ${result.command}`);
 * }
 * ```
 */
export function evaluateAttestedComputation(
  concept: Concept
): AttestationResult {
  if (concept.frontmatter.type !== 'Attested Computation') {
    return {
      passed: false,
      conceptId: concept.id,
      message: `Concept type '${concept.frontmatter.type}' is not an Attested Computation`,
    };
  }

  const executor = concept.frontmatter.executor;
  if (!executor || !executor.run) {
    return {
      passed: false,
      conceptId: concept.id,
      message: 'Missing required frontmatter executor.run field',
    };
  }

  return {
    passed: true,
    conceptId: concept.id,
    executorType: executor.type,
    command: executor.run,
    message: `Attestation command ready for execution: ${executor.run}`,
  };
}
