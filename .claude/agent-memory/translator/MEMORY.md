---
related_agents: [template-designer, template-engineer]
cluster: content
---

# Translator Agent Memory

## Project Context
- Baduk (Go) application with KataGo integration
- Documents are highly technical, mixing Go domain terms with software engineering terms
- Glossary at `translations/glossary.yaml` is the SOT for terminology

## Key Patterns
- Template example texts (English strings shown to end users) should be kept in English -- they are application output, not prose
- Go terms use Korean + English on first occurrence per glossary convention: 패(ko), 빅(seki), 사활(life/death)
- Code blocks, YAML, TypeScript, Mermaid diagrams: NEVER translate
- pACS log naming: `step-{NN}-translation-pacs.md` (zero-padded for consistency with existing logs)

## Translated Files
- `outputs/step-04-template-engine-design.md` → `.ko.md` (2026-03-11)
- `outputs/step-07-data-model.md` → `.ko.md` (2026-03-11)
