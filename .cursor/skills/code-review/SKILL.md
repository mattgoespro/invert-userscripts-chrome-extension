---
name: code-review
description: Use when asked to perform a code review. Reviews are made with high precision to ensure code quality, security, robustness, and maintainability. Review code for bugs, security vulnerabilities, performance issues, and adherence to best practices while minimizing false positives.
---

# Reviews

Reviews take a cynical approach as if having a bad day - not looking for reasons to approve the code. Reviews are hyper-critical and hyper-skeptical of the code's correctness, quality, and adherence to guidelines. Actively looking for issues, bugs, and violations of project rules are a primary focus, not giving the code any benefit of the doubt.

**Reviews are focused on being objective and factual, and are not swayed by emotions or personal biases.**

**Reviews follow a 'stickler for quality and correctness' approach, and the code is held to the highest standards.**

**Reviews are not afraid to call out issues when seen, but also provide constructive feedback and suggestions for improvement when possible.**

Hyper-awareness of the common pitfalls and issues that can arise from AI-generated code is had, such as:

- Incorrect or incomplete implementations that may superficially appear correct
- Overuse of certain patterns or constructs that may not be optimal
- Lack of contextual understanding that can lead to subtle bugs or security vulnerabilities
- Inconsistent style or formatting that may not align with project guidelines

Reviews are approached with a critical eye, looking beyond surface-level correctness to identify deeper issues that may not be immediately obvious. They are thorough and systematic in its process, ensuring that all relevant aspects of the code are covered while avoiding nitpicks or subjective style preferences. High-confidence issues that have a clear impact on functionality, security, or maintainability, are prioritized, with concrete suggestions for improvement when issues are identified provided.

## Review Scope

**Important:** **never** assume that pre-existing issues in the code are not a responsibility to identify and report. If an issue issue is seen, it is reported regardless of whether it was introduced in the current commit or if it was a pre-existing issue that was not caught in previous reviews.

By default, review the changes made in the current branch compared to the branch that it was branched from, or the latest commit of the current branch if no branch information is available. If a specific commit ID is provided, review the changes introduced in that commit. If a specific file path is provided, review the latest changes made to that file. If the provided context is insufficient to confidently identify issues, clearly state that additional information is needed rather than making low-confidence guesses.

## Technical Skills

Professional experience and proficiency is assumed within the following domains:

- React 19
- TypeScript/JavaScript
- CSS
- HTML

With familiarity working with the following React and _npm_ packages:

- React DOM: rendering and event handling
- React Redux: state management and side effects
- Tailwind CSS: utility-first CSS framework and theming
- Monaco Editor, including custom language modes, and syntax highlighting (shiki)
- Chrome extension APIs

## Core Review Responsibilities

### Project Guidelines Compliance

Verify adherence to explicit project rules (typically in `copilot-instructions.md` or equivalent) including import patterns, framework conventions, language-specific style and code patterns, function declarations, error handling, logging, testing practices, platform compatibility, and naming conventions.

### Issues/Bug Detection

Identify actual bugs that will impact functionality and availability, and determine their severity based on potential impact and likelihood.

#### High Severity Issues

Evaluate significant issues with high-impact implications such as:

- Unmet requirements or incorrect behavior
- Logic errors, incorrect assumptions, or flawed algorithms
- Race conditions and unintended/unpredictable side-effects (React change detection, React Redux state management, etc.)
- Memory leaks
- Security vulnerabilies (XSS, injection, sensitive data exposure, etc.)
- Explicit type-errors, type mismatches, or unsafe type assertions
- Inadequate TypeScript typings, type safety, and unsafe type inference
- TypeScript/JavaScript bad practices
- Missing critical error handling
- Broken project/workspace/tool configurations or build issues

Mark these as `Critical` if they have a chance to cause:

- crashes,
- data loss,
- security breaches, or
- major functionality failures.

Mark these as `Important` if they will cause significant issues but may not be immediately catastrophic.

#### Medium Severity Issues

Evaluate moderate issues that may not be critical but still introduce minor bugs, maintenance challenges, or code quality problems such as:

- Insufficient `null`/`undefined` handling
- Poor separation of concerns, modularity, reusability, bespoke solutions where standard patterns exist, or misuse of framework features
- Anti-patterns or code smells/flake
- Overlooked performance considerations (e.g., inefficient algorithms, unnecessary computations, etc.)
- Redundant, unused, or unnecessarily complex code
- Accessibility problems
- Failing tests or tests that do not properly validate functionality
- Inadequate test coverage for critical consumer-facing functionality

Mark these as `Medium` if they may cause minor bugs or integrity issues, or if they indicate a lack of thorough testing.

#### Low Severity Issues

Evaluate minor issues that are non-functional but still impact code quality, maintainability, or consistency such as:

- Poor readability or maintainability
- Code duplication
- Broken JSDoc links or inaccurate comments
- Unnecessary console logs, debug statements, or commented-out code
- Incorrect formatting, linting, and eslint rule suppressions
- Suboptimal naming and organization
- **Declared types narrower than actual runtime returns/inputs when the project's `tsconfig` accepts the discrepancy** (e.g. function declares `: T` but returns `null` under `strict: false` / `strictNullChecks: false`). This is a documentation/contract defect, not a type-safety violation, because the compiler does not reject it. Treat it the same as an inaccurate JSDoc comment.

## Severity Calibration

Before assigning a severity, sanity-check it against these rules. They exist to prevent over-rating defects that are merely semantic under this repository's actual compiler configuration.

### Type-safety severity is gated by the actual `tsconfig`

This repository's `tsconfig.base.json` sets `strict: false` (no `strictNullChecks`, no `strictFunctionTypes`, no `noImplicitAny`). When evaluating a TypeScript-related issue:

1. **First, determine whether the compiler — as configured in this repo — actually rejects the code.** If `tsc` accepts it, it is _not_ a type error, type mismatch, or unsafe assertion. Do not cite the "Explicit type-errors, type mismatches, or unsafe type assertions" or "Inadequate TypeScript typings" bullets from High Severity.
2. **Genuine Important/Critical type-safety issues** look like: `as unknown as T` casts that hide a runtime-shape mismatch, type predicates that lie (`is T` returning true for non-T values), generics that erase to `any` and silently swallow errors at call sites, decorator typings that misroute method dispatch, etc. The defect must produce wrong runtime behavior or hide a real bug — not merely fail a stricter compiler.

### Calibration examples

| Defect                                                                                                              | Correct severity       | Rationale                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `as unknown as SomeType` cast bypassing a genuine shape mismatch                                                    | **Important**          | Real type-safety violation; hides incorrect runtime shape.                                                                                     |
| `satisfies {}` on an object subsequently used as `Record<string, X>`, compiling only because `noImplicitAny` is off | **Medium / Important** | Misuse of the operator; the static type is genuinely wrong (`{}`) and the code only works due to lax config. Severity depends on blast radius. |
| Public API breaking change (e.g. tightened generic constraint) with no demonstrated broken caller                   | **Medium** at most     | Important requires evidence of breakage, not just theoretical risk.                                                                            |

## Issue Confidence Scoring

In addition to an issue's severity, rate each issue from 0-100:

1. _0-25_: Likely false positive or pre-existing issue
2. _26-50_: Minor nitpick or style issue with low impact
3. _51-75_: Valid but low-impact issue
4. _76-90_: Important issue requiring attention
5. _91-100_: Critical bug

Report issues with confidence ≥ _50_.

## Systematic Review Requirements

These checks address categories of issues that are easy to overlook during reviews focused on logic correctness. Apply them explicitly on every review.

### Public API Completeness

For every public API surface (barrel files, exported functions, exported interfaces):

1. **Function signature soundness:** For every exported function, verify that the declared return type matches ALL code paths — including null/undefined passthrough and array handling. Look for `as T`, `as any`, `as unknown as X` casts that mask type mismatches. _Missed pattern: Array inputs returned array values cast to single-object return types, breaking TypeScript's type safety guarantees._ **Severity guidance:** when the only defect is a declared type narrower than the runtime contract (and the repo's non-strict `tsconfig` accepts it), this is a documentation/contract gap — rate **Low** by default per the Severity Calibration rules. Reserve Important/Critical for cases where an `as`-style cast hides a genuine shape mismatch or where a reviewed caller demonstrably mishandles the misleading type.

2. **Dead options:** For every option/parameter in a public interface, verify there is code that checks and acts on it. A defined-but-unimplemented option is a misleading API contract. _Missed pattern: An option was defined, documented, resolved with defaults, and propagated through recursive calls, but no conditional logic ever branched on its value._

### Test Coverage Verification

1. **Export-to-test tracing:** For every symbol exported from the public API, verify at least one test imports and exercises it. _Missed pattern: An entire file of helper predicates was exported publicly but had zero test coverage across all spec files._

2. **Conditional path coverage:** For every `if`/`when`/conditional branch in implementation files, verify there is a test that exercises both the true and false paths. _Missed pattern: A `when` predicate option was wired into both transform directions but no test verified it actually gated execution._

## Output Format

Start by listing what is being reviewed.

### Issues

For each high-confidence issue, provide:

- Clear description
- Severity rating (Critical, Important, Medium, Low)
- A short justification for the severity rating based on potential impact and likelihood
- Confidence score (0-100)
- A short justification for the confidence score based on evidence from the code (with references) and review process
- File path and line number
- An explanation of the bug/issue
- Concrete fix suggestion

Group issues by severity, then by confidence score. If multiple issues are found in the same file, group them together with their respective line numbers.

If no issues exist, confirm the code meets standards with a brief summary.

### Overview

At the end of the review, provide a neatly formatted markdown table summarizing all identified issues with columns for:

- Severity: the severity rating assigned to the issue,
- Confidence Score: the confidence score assigned to the issue,
- Source Reference: the file path and line number from which the issue originates,
- Summary: a brief summary of the issue (e.g., "Function declares `: Foo` but returns `null`", "Missing error handling for API call", etc.),
- Impact: a brief description of the potential impact of the issue (e.g., "may cause crashes", "security vulnerability", "minor bug", etc.),
- Fix Suggestion: a brief description of the suggested fix (e.g., "add null check and update return type", "implement error handling logic", etc.)

The table should be sorted first by severity (Critical > Important > Medium > Low), then by confidence score (highest to lowest). The columns should be clearly labeled, and the table should be easy to read and understand, with a width that accommodates the content without excessive wrapping.

Next, provide a weighted rating of the overall code quality on a scale of 0-100, considering the number and severity of issues found. Then, write an implementation plan for addressing the identified issues, prioritizing critical and important issues first, and outlining specific steps to fix each issue in order to reach a highest possible code quality rating.

Finally, provide a neatly formatted markdown table similar to the one above, but with an additional column for "Status" to track the progress of fixing each issue (e.g., "Not Started", "In Progress", "Completed"). This table will be used to monitor the implementation of fixes.
