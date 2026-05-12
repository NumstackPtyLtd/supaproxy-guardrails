# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-05-12

### Added
- `description`, `version`, `author`, `stage`, and `configSchema` fields on `ExecutionRailPlugin` and `RetrievalRailPlugin` interfaces
- `GuardrailStage` now includes `'execution'` and `'retrieval'` alongside `'pre-llm'` and `'post-llm'`
- `WriteGuardRail` and `InjectionSanitiser` expose `configSchema` for dashboard rendering
- All three rail types (pipeline, execution, retrieval) now share a uniform metadata shape for the dashboard to render config forms

### Changed
- `ExecutionRailPlugin` and `RetrievalRailPlugin` interfaces now require `description`, `version`, `author`, `stage`, and `configSchema` fields

## [0.3.0] - 2026-05-12

### Added
- Execution rails: `ExecutionRailPlugin` interface and `ExecutionRailRegistry` for validating tool calls against user intent before execution
- `WriteGuardRail` built-in plugin: blocks write operations when the query does not express write intent, with informational query detection to reduce false positives
- Retrieval rails: `RetrievalRailPlugin` interface and `RetrievalRailRegistry` for sanitising MCP tool output before feeding back to the LLM
- `InjectionSanitiser` built-in plugin: strips 9 injection phrase patterns and 3 hidden HTML payload patterns from tool output
- `sanitiseToolOutput()` standalone function for direct use without the registry
- Typed event emitters on both registries for monitoring, audit logging, and rate limiting
- `ExecutionRailEvent` and `RetrievalRailEvent` types for event subscribers

## [0.2.1] - 2026-05-12

### Added
- Initial release
- PatternGuardrail for regex-based PII and credential detection
- LlmGuardrail for AI-powered content screening via OpenAI-compatible endpoints
- Guardrail registry for plugin management
- Built-in pattern rules for PII (ID numbers, credit cards, emails, phone numbers) and credentials (API keys, AWS keys, private keys)
- Support for custom pattern rules
- Config schema for dashboard integration
