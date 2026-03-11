# Domain Expert Agent Memory

## Key Decisions
- **Superko variant**: Positional Superko (PSK) chosen over Situational Superko (SSK). CMU source uses SSK; Tromp's website uses PSK. PSK is simpler and more common in computer Go.
- **Suicide**: Legal under Tromp-Taylor. Only restriction is superko.
- **Bent four in corner**: NOT automatically dead under Chinese/TT rules. Must be played out. This differs from Japanese rules.
- **Scoring**: Chinese (area) scoring only for Phase 1. Score = stones on board + empty territory reaching only one color.
- **Dead stone handling**: No agreement phase under Tromp-Taylor. Players must capture dead stones during play.

## Output Files
- `outputs/step-03-domain-knowledge.yaml` — 85 entities, 40 relations, 27 constraints, 20 edge cases
- `outputs/step-03-rules-spec.md` — Full specification with Tromp-Taylor rules, board representation, Zobrist hashing, scoring algorithm

## Primary Sources
- Tromp-Taylor rules: https://tromp.github.io/go.html (10-sentence version)
- CMU version: http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html (8-sentence version)
- Ko bestiary: https://www.cs.cmu.edu/~wjh/go/rules/bestiary.html

## Step Schema Requirements
- step-03.json requires: `knowledge_yaml`, `rules_spec`, `rules_spec_ko` (Korean translation)
- Korean translation needed via @translator subagent

## Board Representation
- 1D Uint8Array, row-major, 0=Empty 1=Black 2=White
- Index math: index = row * size + col
- Zobrist: bigint[2][N*N], 64-bit, fixed-seed PRNG, XOR-based incremental
