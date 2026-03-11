// =============================================================================
// Module: explanation-engine/patterns — Compiled Pattern Catalog
// =============================================================================
// This file contains all 90 patterns from Step 4's pattern-catalog.yaml,
// compiled into TypeScript for runtime use. Patterns are loaded at module
// initialization time and are immutable.
//
// Pattern ID Convention: P-T{tier}-{category_code}-{number}
//   Tier:     1=Beginner, 2=Intermediate, 3=Advanced
//   Category: MQ=Move Quality, PA=Position Assessment, OP=Opening,
//             MG=Middle Game, EG=Endgame, LD=Life/Death,
//             KO=Ko, SK=Seki, AL=Alternative, GN=Generic
//
// IMPORTANT: All mandatory patterns (LD, KO, SK) have mandatory: true.
// The fallback chain enforces that these NEVER go through LLM generation.
// =============================================================================

import type { InternalPattern } from './types'

/**
 * Complete pattern catalog: 90 patterns (30 per tier).
 * Loaded from Step 4's pattern-catalog.yaml.
 */
export const PATTERN_CATALOG: readonly InternalPattern[] = [
  // ===========================================================================
  // BEGINNER TIER (T1) — 30 Patterns
  // ===========================================================================

  // --- T1: MOVE QUALITY (7 patterns) ---

  {
    id: 'P-T1-MQ-01',
    name: 'Blunder',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [{ field: 'winrateDelta', operator: '<', value: -0.1 }],
    },
    template: {
      text: 'Careful! This move gave away a big lead. Your winning chance dropped by {winrate_delta_pct}%. A better spot would have been {best_move}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'integer' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-02',
    name: 'Mistake',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.05 },
        { field: 'winrateDelta', operator: '>=', value: -0.1 },
      ],
    },
    template: {
      text: 'This move was not the best choice. Your winning chance went down by {winrate_delta_pct}%. Next time, try looking at {best_move} instead.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'integer' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-03',
    name: 'Inaccuracy',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.02 },
        { field: 'winrateDelta', operator: '>=', value: -0.05 },
      ],
    },
    template: {
      text: 'This move was okay, but there was a slightly better option at {best_move}. Your chances changed by just {winrate_delta_pct}%, so no big deal.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'integer' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-04',
    name: 'Brilliant Move',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'moveInfos[0].prior', operator: '<', value: 0.05 },
        { field: 'moveInfos[0].visits', operator: '>', value: 100 },
      ],
    },
    template: {
      text: 'Wow, great find! This move was hard to spot, but it turns out to be the best choice. Even the computer did not expect it at first.',
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-05',
    name: 'Excellent Move',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'topMoveGap', operator: '>', value: 0.03 },
      ],
    },
    template: {
      text: 'Excellent move! This was clearly the best option and puts you in a strong position. You are now ahead by about {score_lead} points.',
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-06',
    name: 'Good Move',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'moveRank', operator: '==', value: 0 }],
    },
    template: {
      text: "Nice choice! This is the computer's top pick too. Your winning chance is {winrate_pct}%.",
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MQ-07',
    name: 'Acceptable Move',
    tier: 'beginner',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: 'in', value: [1, 2] },
        { field: 'winrateDelta', operator: '>=', value: -0.02 },
      ],
    },
    template: {
      text: "Solid move. It was not the computer's top choice, but it is very close. You are doing fine here.",
      slots: {},
    },
    fallbackId: null,
  },

  // --- T1: POSITION ASSESSMENT (4 patterns) ---

  {
    id: 'P-T1-PA-01',
    name: 'Decisive Advantage',
    tier: 'beginner',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '>', value: 0.85 }],
    },
    template: {
      text: 'You are in a very strong position! The computer gives you a {winrate_pct}% chance of winning. Keep playing carefully and the game is yours.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-PA-02',
    name: 'Strong Advantage',
    tier: 'beginner',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>', value: 0.65 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.85 },
      ],
    },
    template: {
      text: 'Things are looking good for you. You have a {winrate_pct}% winning chance and lead by about {score_lead} points.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-PA-03',
    name: 'Even Position',
    tier: 'beginner',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>=', value: 0.45 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.55 },
      ],
    },
    template: {
      text: 'The game is very close right now. Both players have a roughly equal chance of winning. Every move counts!',
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-PA-04',
    name: 'Significant Disadvantage',
    tier: 'beginner',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '<', value: 0.35 }],
    },
    template: {
      text: 'You are behind right now. The computer gives you a {winrate_pct}% chance. But do not give up — comebacks happen!',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T1: OPENING (3 patterns) ---

  {
    id: 'P-T1-OP-01',
    name: 'Opening Strong Move',
    tier: 'beginner',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'moveRank', operator: '==', value: 0 },
      ],
    },
    template: {
      text: 'Good start! In the opening, it is important to claim the corners and sides. This move does that well.',
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-OP-02',
    name: 'Opening Suboptimal Move',
    tier: 'beginner',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: 'In the early game, try to play near the corners and edges first. The computer suggests {best_move} as a better opening move.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-OP-03',
    name: 'Opening Neutral',
    tier: 'beginner',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'opening' }],
    },
    template: {
      text: 'The game is just getting started. Both players are setting up their positions. Your winning chance is {winrate_pct}%.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T1: MIDDLE GAME (3 patterns) ---

  {
    id: 'P-T1-MG-01',
    name: 'Middle Game Advantage',
    tier: 'beginner',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'You are doing well in the middle of the game. You lead by about {score_lead} points. Try to keep your groups connected and safe.',
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MG-02',
    name: 'Middle Game Disadvantage',
    tier: 'beginner',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: "The middle of the game is tricky. You are a bit behind right now. Look for chances to surround more area or put pressure on your opponent's groups.",
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-MG-03',
    name: 'Middle Game Close',
    tier: 'beginner',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'middle_game' }],
    },
    template: {
      text: 'The game is close in the middle phase. Both players have chances. Your winning chance is {winrate_pct}%.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T1: ENDGAME (3 patterns) ---

  {
    id: 'P-T1-EG-01',
    name: 'Endgame Winning',
    tier: 'beginner',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'You are ahead near the end of the game! You lead by about {score_lead} points. Focus on securing the borders of your territory.',
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-EG-02',
    name: 'Endgame Losing',
    tier: 'beginner',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: 'You are behind near the end of the game. The computer sees your opponent ahead by about {score_lead_abs} points. Look for any remaining big moves.',
      slots: {
        score_lead_abs: { source: 'abs(rootInfo.scoreLead)', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-EG-03',
    name: 'Endgame Close',
    tier: 'beginner',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'endgame' }],
    },
    template: {
      text: 'The game is very close near the end! Every point matters. Your winning chance is {winrate_pct}%.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T1: LIFE/DEATH — MANDATORY (3 patterns + fallbacks) ---

  {
    id: 'P-T1-LD-01',
    name: 'Group Alive',
    tier: 'beginner',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '>', value: 3.0 },
      ],
    },
    template: {
      text: 'This group of stones is safe. It has enough room to survive. You do not need to worry about it right now.',
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-LD-02',
    name: 'Group Dead',
    tier: 'beginner',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '<', value: -5.0 },
      ],
    },
    template: {
      text: 'This group of stones is in danger. The computer thinks it will be captured. Try to avoid this situation in the future.',
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-LD-03',
    name: 'Group Unsettled',
    tier: 'beginner',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'life_death' }],
    },
    template: {
      text: "This group's fate is not decided yet. The next few moves will determine if it survives. The best move here is {best_move}.",
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T1: KO — MANDATORY (2 patterns) ---

  {
    id: 'P-T1-KO-01',
    name: 'Ko Fight Large',
    tier: 'beginner',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'ko' },
        { field: 'ko_value', operator: '>', value: 5.0 },
      ],
    },
    template: {
      text: "A special kind of fight called a 'ko' is happening here. Both players take turns trying to win this area. It is worth about {ko_value} points, so it is very important!",
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-KO-02',
    name: 'Ko Fight Small',
    tier: 'beginner',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'ko' }],
    },
    template: {
      text: "There is a small back-and-forth fight here called a 'ko'. It is worth about {ko_value} points.",
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T1: SEKI — MANDATORY (1 pattern) ---

  {
    id: 'P-T1-SK-01',
    name: 'Seki Detected',
    tier: 'beginner',
    category: 'seki',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'seki' }],
    },
    template: {
      text: 'Both groups of stones here are alive. Neither player can capture the other without losing their own stones. They will both stay on the board.',
      slots: {},
    },
    fallbackId: null,
  },

  // --- T1: ALTERNATIVE MOVES (2 patterns) ---

  {
    id: 'P-T1-AL-01',
    name: 'Better Alternative Available',
    tier: 'beginner',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: '>', value: 0 },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: "The computer's top choice was {best_move}. If you played there, your winning chance would be {best_winrate_pct}% instead of {winrate_pct}%.",
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'integer' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-AL-02',
    name: 'Multiple Good Options',
    tier: 'beginner',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'topMoveGap', operator: '<', value: 0.02 }],
    },
    template: {
      text: 'There are several good choices here. The computer likes {best_move} and {second_move} almost equally. You cannot go wrong with either!',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T1: GENERIC / CONFIDENCE (2 patterns) ---

  {
    id: 'P-T1-GN-01',
    name: 'Position Summary',
    tier: 'beginner',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [],
    },
    template: {
      text: "The computer's best suggestion is {best_move}. Your current winning chance is {winrate_pct}%.",
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T1-GN-02',
    name: 'Low Confidence Warning',
    tier: 'beginner',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.visits', operator: '<', value: 50 }],
    },
    template: {
      text: 'The computer had limited time to think here, so this analysis might not be as reliable.',
      slots: {},
    },
    fallbackId: null,
  },

  // ===========================================================================
  // INTERMEDIATE TIER (T2) — 30 Patterns
  // ===========================================================================

  // --- T2: MOVE QUALITY (7 patterns) ---

  {
    id: 'P-T2-MQ-01',
    name: 'Blunder',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [{ field: 'winrateDelta', operator: '<', value: -0.1 }],
    },
    template: {
      text: 'Significant blunder. Win rate dropped by {winrate_delta_pct}%, losing about {score_delta} points. The engine strongly preferred {best_move}, leading to the sequence {pv_medium}. The position shifts from a {prev_assessment} to a {curr_assessment}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        score_delta: { source: 'abs(computed.scoreLeadDelta)', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
        prev_assessment: { source: 'computed.previous_assessment_label', format: 'string' },
        curr_assessment: { source: 'computed.current_assessment_label', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-02',
    name: 'Mistake',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.05 },
        { field: 'winrateDelta', operator: '>=', value: -0.1 },
      ],
    },
    template: {
      text: 'This move was a mistake, dropping win rate by {winrate_delta_pct}%. The engine preferred {best_move} (WR: {best_winrate_pct}%). Key follow-up: {pv_medium}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-03',
    name: 'Inaccuracy',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.02 },
        { field: 'winrateDelta', operator: '>=', value: -0.05 },
      ],
    },
    template: {
      text: 'Minor inaccuracy. The engine preferred {best_move} (WR: {best_winrate_pct}%) over the played move. The difference is {winrate_delta_pct}% — not critical, but worth noting.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-04',
    name: 'Brilliant Move',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'moveInfos[0].prior', operator: '<', value: 0.05 },
        { field: 'moveInfos[0].visits', operator: '>', value: 100 },
      ],
    },
    template: {
      text: "Brilliant move! The neural network's initial policy gave this only a {prior_pct}% chance, but deep search confirmed it as the best. This kind of unexpected tesuji shows strong reading ability.",
      slots: {
        prior_pct: { source: 'computed.prior_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-05',
    name: 'Excellent Move',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'topMoveGap', operator: '>', value: 0.03 },
      ],
    },
    template: {
      text: "Excellent move. This was clearly the best choice, outperforming alternatives by {top_gap_pct}% in win rate. Score lead: {score_lead} points. The engine's follow-up: {pv_medium}.",
      slots: {
        top_gap_pct: { source: 'computed.topMoveGap * 100', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-06',
    name: 'Good Move',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'moveRank', operator: '==', value: 0 }],
    },
    template: {
      text: "Good move — this matches the engine's top choice. Win rate: {winrate_pct}%, score lead: {score_lead} points.",
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MQ-07',
    name: 'Acceptable Move',
    tier: 'intermediate',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: 'in', value: [1, 2] },
        { field: 'winrateDelta', operator: '>=', value: -0.02 },
      ],
    },
    template: {
      text: "Reasonable move. Ranked #{move_rank_display} by the engine, but within {winrate_delta_pct}% of the top choice. The engine's preference was {best_move}.",
      slots: {
        move_rank_display: { source: 'computed.moveRank + 1', format: 'integer' },
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T2: POSITION ASSESSMENT (4 patterns) ---

  {
    id: 'P-T2-PA-01',
    name: 'Decisive Advantage',
    tier: 'intermediate',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '>', value: 0.85 }],
    },
    template: {
      text: 'Decisive advantage. Win rate: {winrate_pct}%, score lead: {score_lead} points. The game is essentially decided barring a major blunder.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-PA-02',
    name: 'Strong Advantage',
    tier: 'intermediate',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>', value: 0.65 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.85 },
      ],
    },
    template: {
      text: 'Strong advantage with {winrate_pct}% win rate and a {score_lead}-point lead. The territory balance favors you, but the game is not over. Focus on maintaining solid shape and avoiding overplays.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-PA-03',
    name: 'Even Position',
    tier: 'intermediate',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>=', value: 0.45 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.55 },
      ],
    },
    template: {
      text: 'The position is balanced. Win rate: {winrate_pct}%, score: {score_lead} points. Both sides have potential — the next strategic decision could tip the balance.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-PA-04',
    name: 'Significant Disadvantage',
    tier: 'intermediate',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '<', value: 0.35 }],
    },
    template: {
      text: 'Difficult position. Win rate: {winrate_pct}%, trailing by about {score_lead_abs} points. Look for aggressive moves or try to complicate the position — simple plays favor the opponent.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead_abs: { source: 'abs(rootInfo.scoreLead)', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },

  // --- T2: OPENING (3 patterns) ---

  {
    id: 'P-T2-OP-01',
    name: 'Opening Good Move',
    tier: 'intermediate',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'moveRank', operator: '==', value: 0 },
      ],
    },
    template: {
      text: 'Sound opening choice. This move follows standard fuseki principles — establishing presence in the corners and along the sides. Win rate: {winrate_pct}%.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-OP-02',
    name: 'Opening Suboptimal',
    tier: 'intermediate',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: 'In the opening, the engine preferred {best_move} (WR: {best_winrate_pct}%). At this stage, prioritize corner enclosures, approach moves, and establishing a balanced framework.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-OP-03',
    name: 'Opening General',
    tier: 'intermediate',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'opening' }],
    },
    template: {
      text: "Early game — the opening is still developing. The engine's top choice is {best_move}. Both sides are staking claims in the corners and sides.",
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T2: MIDDLE GAME (3 patterns) ---

  {
    id: 'P-T2-MG-01',
    name: 'Middle Game Advantage',
    tier: 'intermediate',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'Favorable middle game position. Win rate: {winrate_pct}%, leading by {score_lead} points. Focus on consolidating territory and keeping your groups connected. The engine suggests {best_move}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MG-02',
    name: 'Middle Game Disadvantage',
    tier: 'intermediate',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: "Challenging middle game. You are behind by about {score_lead_abs} points. Consider invading or reducing your opponent's territorial framework. The engine's recommendation: {best_move} with the sequence {pv_medium}.",
      slots: {
        score_lead_abs: { source: 'abs(rootInfo.scoreLead)', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-MG-03',
    name: 'Middle Game Balanced',
    tier: 'intermediate',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'middle_game' }],
    },
    template: {
      text: 'Balanced middle game. Win rate: {winrate_pct}%, score: {score_lead} points. The engine recommends {best_move}. Both players have influence in different areas of the board.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T2: ENDGAME (3 patterns) ---

  {
    id: 'P-T2-EG-01',
    name: 'Endgame Winning',
    tier: 'intermediate',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'Winning endgame. Leading by {score_lead} points (WR: {winrate_pct}%). Focus on yose (endgame) efficiency: play the biggest boundary moves first. The engine suggests {best_move} as the largest remaining move.',
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-EG-02',
    name: 'Endgame Losing',
    tier: 'intermediate',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: 'Trailing in the endgame by about {score_lead_abs} points. Look for sente endgame moves and any remaining boundary disputes. The engine suggests {best_move}.',
      slots: {
        score_lead_abs: { source: 'abs(rootInfo.scoreLead)', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-EG-03',
    name: 'Endgame Close',
    tier: 'intermediate',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'endgame' }],
    },
    template: {
      text: "Close endgame. Score difference: {score_lead} points (WR: {winrate_pct}%). Every sente and gote calculation matters. The engine's top yose move: {best_move}.",
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T2: LIFE/DEATH — MANDATORY (3 patterns) ---

  {
    id: 'P-T2-LD-01',
    name: 'Group Alive',
    tier: 'intermediate',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '>', value: 3.0 },
      ],
    },
    template: {
      text: "This group is alive. The engine's ownership analysis confirms it has sufficient eye space to survive. No immediate action needed.",
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-LD-02',
    name: 'Group Dead',
    tier: 'intermediate',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '<', value: -5.0 },
      ],
    },
    template: {
      text: "This group is dead according to the engine's analysis. It lacks sufficient eye space to make two eyes. The engine suggests this group cannot be saved with optimal opponent play.",
      slots: {},
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-LD-03',
    name: 'Group Unsettled',
    tier: 'intermediate',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'life_death' }],
    },
    template: {
      text: "The life-and-death status of this group is unsettled. The engine's best move is {best_move} (WR: {best_winrate_pct}%). The critical sequence: {pv_medium}. Who plays next determines the group's fate.",
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T2: KO — MANDATORY (2 patterns) ---

  {
    id: 'P-T2-KO-01',
    name: 'Ko Fight Large',
    tier: 'intermediate',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'ko' },
        { field: 'ko_value', operator: '>', value: 5.0 },
      ],
    },
    template: {
      text: "Active ko fight worth approximately {ko_value} points. This is a significant ko — finding strong ko threats is essential. The engine's recommended sequence: {pv_medium}. Win rate with best play: {best_winrate_pct}%.",
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'one_decimal' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-KO-02',
    name: 'Ko Fight Small',
    tier: 'intermediate',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'ko' }],
    },
    template: {
      text: 'Small ko fight worth about {ko_value} points. Consider whether the ko threats available justify fighting here or if it is better to take gote and play elsewhere.',
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },

  // --- T2: SEKI — MANDATORY (1 pattern) ---

  {
    id: 'P-T2-SK-01',
    name: 'Seki Detected',
    tier: 'intermediate',
    category: 'seki',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'seki' }],
    },
    template: {
      text: "Seki (mutual life) detected. Neither group can capture the other — playing in the shared liberties would be self-atari. Under Chinese scoring, both groups' stones count for their respective owners. The shared liberties score zero.",
      slots: {},
    },
    fallbackId: null,
  },

  // --- T2: ALTERNATIVE MOVES (2 patterns) ---

  {
    id: 'P-T2-AL-01',
    name: 'Better Alternative',
    tier: 'intermediate',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: '>', value: 0 },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: 'The engine preferred {best_move} (WR: {best_winrate_pct}%, Score: {best_score}) over the played move. The top line: {pv_medium}.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-AL-02',
    name: 'Multiple Close Options',
    tier: 'intermediate',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'topMoveGap', operator: '<', value: 0.02 }],
    },
    template: {
      text: 'Multiple strong candidates: {best_move} (WR: {best_winrate_pct}%, V: {best_visits}) and {second_move} (WR: {second_winrate_pct}%, V: {second_visits}). The difference is marginal — both are good choices.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_winrate_pct: { source: 'moveInfos[1].winrate * 100', format: 'one_decimal' },
        second_visits: { source: 'moveInfos[1].visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T2: GENERIC / CONFIDENCE (2 patterns) ---

  {
    id: 'P-T2-GN-01',
    name: 'Position Summary',
    tier: 'intermediate',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [],
    },
    template: {
      text: "Position evaluation — WR: {winrate_pct}%, Score: {score_lead} points. Engine's top move: {best_move} ({best_visits} visits). Follow-up: {pv_medium}.",
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_medium: { source: 'computed.pv_medium', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T2-GN-02',
    name: 'Low Confidence Warning',
    tier: 'intermediate',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.visits', operator: '<', value: 50 }],
    },
    template: {
      text: 'Low confidence analysis ({total_visits} visits). Results may change significantly with deeper search. Consider this a rough estimate.',
      slots: {
        total_visits: { source: 'rootInfo.visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // ===========================================================================
  // ADVANCED TIER (T3) — 30 Patterns
  // ===========================================================================

  // --- T3: MOVE QUALITY (7 patterns) ---

  {
    id: 'P-T3-MQ-01',
    name: 'Blunder',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [{ field: 'winrateDelta', operator: '<', value: -0.1 }],
    },
    template: {
      text: 'Blunder. Delta: -{winrate_delta_pct}% WR, -{score_delta} pts. Best: {best_move} (WR: {best_winrate_pct}%, Score: {best_score}, V: {best_visits}, Prior: {best_prior_pct}%). PV: {pv_long}. Position shifts from {prev_assessment} to {curr_assessment}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        score_delta: { source: 'abs(computed.scoreLeadDelta)', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        best_prior_pct: { source: 'moveInfos[0].prior * 100', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
        prev_assessment: { source: 'computed.previous_assessment_label', format: 'string' },
        curr_assessment: { source: 'computed.current_assessment_label', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-02',
    name: 'Mistake',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.05 },
        { field: 'winrateDelta', operator: '>=', value: -0.1 },
      ],
    },
    template: {
      text: 'Mistake. Delta: -{winrate_delta_pct}% WR, -{score_delta} pts. Best: {best_move} (WR: {best_winrate_pct}%, Score: {best_score}, V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        score_delta: { source: 'abs(computed.scoreLeadDelta)', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-03',
    name: 'Inaccuracy',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'winrateDelta', operator: '<', value: -0.02 },
        { field: 'winrateDelta', operator: '>=', value: -0.05 },
      ],
    },
    template: {
      text: 'Inaccuracy. Delta: -{winrate_delta_pct}% WR. Best: {best_move} (WR: {best_winrate_pct}%, Score: {best_score}). PV: {pv_long}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-04',
    name: 'Brilliant Move',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'moveInfos[0].prior', operator: '<', value: 0.05 },
        { field: 'moveInfos[0].visits', operator: '>', value: 100 },
      ],
    },
    template: {
      text: 'Brilliant. Policy prior: {prior_pct}% (the NN initially underestimated this move), but search confirmed it as optimal with {best_visits} visits. WR: {winrate_pct}%, Score: {score_lead}. PV: {pv_long}.',
      slots: {
        prior_pct: { source: 'computed.prior_pct', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-05',
    name: 'Excellent Move',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'moveRank', operator: '==', value: 0 },
        { field: 'topMoveGap', operator: '>', value: 0.03 },
      ],
    },
    template: {
      text: 'Optimal. Top choice by {top_gap_pct}% WR margin over #2 {second_move}. WR: {winrate_pct}%, Score: {score_lead}. V: {best_visits}. PV: {pv_long}.',
      slots: {
        top_gap_pct: { source: 'computed.topMoveGap * 100', format: 'one_decimal' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-06',
    name: 'Good Move',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'moveRank', operator: '==', value: 0 }],
    },
    template: {
      text: '{move} — optimal. WR: {winrate_pct}%, Score: {score_lead}. V: {best_visits}. Prior: {prior_pct}%. PV: {pv_long}.',
      slots: {
        move: { source: 'moveInfos[0].move', format: 'string' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        prior_pct: { source: 'computed.prior_pct', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MQ-07',
    name: 'Acceptable Move',
    tier: 'advanced',
    category: 'move_quality',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: 'in', value: [1, 2] },
        { field: 'winrateDelta', operator: '>=', value: -0.02 },
      ],
    },
    template: {
      text: 'Suboptimal but playable. Ranked #{move_rank_display}. Delta: -{winrate_delta_pct}% WR. Best was {best_move} (V: {best_visits}). The played move and the best move are within acceptable margin.',
      slots: {
        move_rank_display: { source: 'computed.moveRank + 1', format: 'integer' },
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T3: POSITION ASSESSMENT (4 patterns) ---

  {
    id: 'P-T3-PA-01',
    name: 'Decisive Advantage',
    tier: 'advanced',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '>', value: 0.85 }],
    },
    template: {
      text: 'Decisive. WR: {winrate_pct}%, Score: {score_lead}. V: {total_visits}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        total_visits: { source: 'rootInfo.visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-PA-02',
    name: 'Strong Advantage',
    tier: 'advanced',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>', value: 0.65 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.85 },
      ],
    },
    template: {
      text: 'Strong advantage. WR: {winrate_pct}%, Score: {score_lead}. V: {total_visits}. Top move: {best_move}. PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        total_visits: { source: 'rootInfo.visits', format: 'integer' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-PA-03',
    name: 'Even Position',
    tier: 'advanced',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'rootInfo.winrate', operator: '>=', value: 0.45 },
        { field: 'rootInfo.winrate', operator: '<=', value: 0.55 },
      ],
    },
    template: {
      text: 'Balanced position. WR: {winrate_pct}%, Score: {score_lead}. Top: {best_move} (V: {best_visits}) vs {second_move} (V: {second_visits}).',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_visits: { source: 'moveInfos[1].visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-PA-04',
    name: 'Significant Disadvantage',
    tier: 'advanced',
    category: 'position',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.winrate', operator: '<', value: 0.35 }],
    },
    template: {
      text: 'Difficult. WR: {winrate_pct}%, Score: {score_lead}. Best: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T3: OPENING (3 patterns) ---

  {
    id: 'P-T3-OP-01',
    name: 'Opening Optimal',
    tier: 'advanced',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'moveRank', operator: '==', value: 0 },
      ],
    },
    template: {
      text: 'Opening — optimal. WR: {winrate_pct}%, Score: {score_lead}. Prior: {prior_pct}%. V: {best_visits}. PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        prior_pct: { source: 'moveInfos[0].prior * 100', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-OP-02',
    name: 'Opening Suboptimal',
    tier: 'advanced',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'opening' },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: 'Opening inaccuracy. Delta: -{winrate_delta_pct}% WR. Best: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_delta_pct: { source: 'computed.winrate_delta_pct', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-OP-03',
    name: 'Opening General',
    tier: 'advanced',
    category: 'opening',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'opening' }],
    },
    template: {
      text: 'Opening position. WR: {winrate_pct}%, Score: {score_lead}. Top move: {best_move} (V: {best_visits}). {candidates_count} candidates analyzed.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        candidates_count: { source: 'moveInfos.length', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T3: MIDDLE GAME (3 patterns) ---

  {
    id: 'P-T3-MG-01',
    name: 'Middle Game Advantage',
    tier: 'advanced',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'Middle game — favorable. WR: {winrate_pct}%, Score: {score_lead}. Best: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MG-02',
    name: 'Middle Game Disadvantage',
    tier: 'advanced',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'middle_game' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: 'Middle game — unfavorable. WR: {winrate_pct}%, Score: {score_lead}. Best: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-MG-03',
    name: 'Middle Game Balanced',
    tier: 'advanced',
    category: 'middle_game',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'middle_game' }],
    },
    template: {
      text: 'Middle game — balanced. WR: {winrate_pct}%, Score: {score_lead}. Top: {best_move} (V: {best_visits}) vs {second_move} (V: {second_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_visits: { source: 'moveInfos[1].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T3: ENDGAME (3 patterns) ---

  {
    id: 'P-T3-EG-01',
    name: 'Endgame Winning',
    tier: 'advanced',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '>', value: 0.55 },
      ],
    },
    template: {
      text: 'Endgame — winning. WR: {winrate_pct}%, Score: {score_lead}. Best yose: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-EG-02',
    name: 'Endgame Losing',
    tier: 'advanced',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'movePhase', operator: '==', value: 'endgame' },
        { field: 'rootInfo.winrate', operator: '<', value: 0.45 },
      ],
    },
    template: {
      text: 'Endgame — trailing. WR: {winrate_pct}%, Score: {score_lead}. Best: {best_move} (V: {best_visits}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-EG-03',
    name: 'Endgame Close',
    tier: 'advanced',
    category: 'endgame',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'movePhase', operator: '==', value: 'endgame' }],
    },
    template: {
      text: 'Close endgame. WR: {winrate_pct}%, Score: {score_lead}. Best: {best_move} (V: {best_visits}, Score: {best_score}). #2: {second_move} (Score: {second_score}). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_score: { source: 'moveInfos[1].scoreLead', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T3: LIFE/DEATH — MANDATORY (3 patterns) ---

  {
    id: 'P-T3-LD-01',
    name: 'Group Alive',
    tier: 'advanced',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '>', value: 3.0 },
      ],
    },
    template: {
      text: "Group likely alive based on score analysis (Score: {score_lead}). The engine's analysis confirms sufficient eye space.",
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-LD-02',
    name: 'Group Dead',
    tier: 'advanced',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'life_death' },
        { field: 'rootInfo.scoreLead', operator: '<', value: -5.0 },
      ],
    },
    template: {
      text: 'Group likely dead based on score analysis (Score: {score_lead}). Critical line: {pv_long}.',
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-LD-03',
    name: 'Group Unsettled',
    tier: 'advanced',
    category: 'life_death',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'life_death' }],
    },
    template: {
      text: 'Life/death unsettled. Best: {best_move} (WR: {best_winrate_pct}%, Score: {best_score}, V: {best_visits}). PV: {pv_long}. The status depends on who plays first.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },

  // --- T3: KO — MANDATORY (2 patterns) ---

  {
    id: 'P-T3-KO-01',
    name: 'Ko Fight Large',
    tier: 'advanced',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [
        { field: 'category', operator: '==', value: 'ko' },
        { field: 'ko_value', operator: '>', value: 5.0 },
      ],
    },
    template: {
      text: 'Significant ko fight. Estimated value: {ko_value} pts. Best: {best_move} (WR: {best_winrate_pct}%, V: {best_visits}). PV: {pv_long}.',
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-KO-02',
    name: 'Ko Fight Small',
    tier: 'advanced',
    category: 'ko',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'ko' }],
    },
    template: {
      text: 'Minor ko. Value: ~{ko_value} pts. Best: {best_move} (V: {best_visits}). PV: {pv_long}. Score: {score_lead}.',
      slots: {
        ko_value: { source: 'computed.ko_value', format: 'one_decimal' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },

  // --- T3: SEKI — MANDATORY (1 pattern) ---

  {
    id: 'P-T3-SK-01',
    name: 'Seki Detected',
    tier: 'advanced',
    category: 'seki',
    mandatory: true,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'category', operator: '==', value: 'seki' }],
    },
    template: {
      text: "Seki confirmed. Neither group can initiate capture without self-atari. Under Chinese scoring, both groups' stones count as territory for their owners. Score: {score_lead}. WR: {winrate_pct}%.",
      slots: {
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
      },
    },
    fallbackId: null,
  },

  // --- T3: ALTERNATIVE MOVES (2 patterns) ---

  {
    id: 'P-T3-AL-01',
    name: 'Better Alternative',
    tier: 'advanced',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: true,
      conditions: [
        { field: 'moveRank', operator: '>', value: 0 },
        { field: 'winrateDelta', operator: '<', value: -0.02 },
      ],
    },
    template: {
      text: 'Suboptimal. Best: {best_move} (WR: {best_winrate_pct}%, Score: {best_score}, V: {best_visits}). #2: {second_move} (WR: {second_winrate_pct}%). PV: {pv_long}. Played move: ranked #{move_rank_display}.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_score: { source: 'moveInfos[0].scoreLead', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_winrate_pct: { source: 'moveInfos[1].winrate * 100', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
        move_rank_display: { source: 'computed.moveRank + 1', format: 'integer' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-AL-02',
    name: 'Multiple Close Options',
    tier: 'advanced',
    category: 'alternative',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'topMoveGap', operator: '<', value: 0.02 }],
    },
    template: {
      text: 'Miai-like position. {best_move} (WR: {best_winrate_pct}%, V: {best_visits}) and {second_move} (WR: {second_winrate_pct}%, V: {second_visits}) are nearly equivalent. Either is acceptable.',
      slots: {
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_winrate_pct: { source: 'computed.best_winrate_pct', format: 'one_decimal' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        second_move: { source: 'moveInfos[1].move', format: 'string' },
        second_winrate_pct: { source: 'moveInfos[1].winrate * 100', format: 'one_decimal' },
        second_visits: { source: 'moveInfos[1].visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },

  // --- T3: GENERIC / CONFIDENCE (2 patterns) ---

  {
    id: 'P-T3-GN-01',
    name: 'Position Summary',
    tier: 'advanced',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [],
    },
    template: {
      text: 'Position — WR: {winrate_pct}%, Score: {score_lead}. V: {total_visits}. Best: {best_move} (V: {best_visits}, Prior: {prior_pct}%). PV: {pv_long}.',
      slots: {
        winrate_pct: { source: 'computed.winrate_pct', format: 'one_decimal' },
        score_lead: { source: 'rootInfo.scoreLead', format: 'one_decimal' },
        total_visits: { source: 'rootInfo.visits', format: 'integer' },
        best_move: { source: 'moveInfos[0].move', format: 'string' },
        best_visits: { source: 'moveInfos[0].visits', format: 'integer' },
        prior_pct: { source: 'moveInfos[0].prior * 100', format: 'one_decimal' },
        pv_long: { source: 'computed.pv_long', format: 'string' },
      },
    },
    fallbackId: null,
  },
  {
    id: 'P-T3-GN-02',
    name: 'Low Confidence Warning',
    tier: 'advanced',
    category: 'generic',
    mandatory: false,
    trigger: {
      requiresDelta: false,
      conditions: [{ field: 'rootInfo.visits', operator: '<', value: 50 }],
    },
    template: {
      text: 'Low confidence ({total_visits} visits). Results may be unreliable. Consider deeper search before drawing conclusions.',
      slots: {
        total_visits: { source: 'rootInfo.visits', format: 'integer' },
      },
    },
    fallbackId: null,
  },
]
