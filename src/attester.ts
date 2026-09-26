import { Concept } from './schema.js';

export interface AttestationResult {
  passed: boolean;
  conceptId: string;
  executorType?: string;
  command?: string;
  message: string;
}

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
