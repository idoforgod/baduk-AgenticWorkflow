---
related_agents: [katago-integrator]
cluster: katago
---

# KataGo Researcher Memory

## Key Facts (verified)

- KataGo backend is COMPILE-TIME, not runtime. Each binary supports exactly one backend.
- Backends: TensorRT > CUDA > Metal > OpenCL > Eigen AVX2 > Eigen (performance order)
- Analysis Engine protocol: line-delimited JSON over stdin/stdout, responses may arrive out of order
- v1.16.4 is latest as of 2026-03-11. Added playSelectionValue field, experimental eval-caching.
- Model version 16 supported in v1.16.x. Backward compatible with v14, v15 models.
- b18c384nbt uses nested bottleneck (factor 2) with mish activation, not ReLU.
- Official docs: `docs/Analysis_Engine.md` is the primary source for JSON protocol.
- OpenCL requires 5-30 min first-run auto-tuning (cached afterward).

## Model Sizes (from g65 archive .zip format)
- b6c96: 8.4 MB (.zip), ~3.5 MB (.bin.gz estimated)
- b10c128: 24 MB (.zip), ~11 MB (.bin.gz estimated)
- b15c192: 81 MB (.zip), ~35 MB (.bin.gz estimated)
- b18c384nbt: ~65 MB (.bin.gz estimated, NOT directly verified)
- b28c512nbt: ~170 MB (.bin.gz estimated, NOT directly verified)

## Performance Reference (b18c384nbt)
- TensorRT RTX 5070: ~3,262 v/s | CUDA: ~2,294 v/s | OpenCL: ~1,250 v/s
- Metal M3 Max: ~348 v/s | Eigen AVX2: ~52 v/s | Eigen plain: ~38 v/s

## Important URLs
- Analysis docs: https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md
- Config example: https://github.com/lightvector/KataGo/blob/master/cpp/configs/analysis_example.cfg
- Networks: https://katagotraining.org/networks/
- Source: https://github.com/lightvector/KataGo/blob/master/cpp/command/analysis.cpp

## Lessons
- WebFetch to github.com/lightvector/KataGo/blob/ returns 429; use raw.githubusercontent.com instead.
- katagotraining.org/networks/ does not show file sizes in easily scrapeable format.
- g65 archive at katagoarchive.org has older models with visible sizes.
