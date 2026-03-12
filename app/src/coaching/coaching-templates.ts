// =============================================================================
// coaching/coaching-templates.ts — Pre-Authored Coaching Template Catalog
// =============================================================================
// Contains all 52 coaching templates (45 base + 7 suffix) from
// outputs/step-26-coaching-catalog.yaml.
//
// Core invariant: KataGo = truth, LLM = zero.
// Every {placeholder} maps to a KataGo field or deterministic computation.
// All templates are pre-authored. Zero runtime text generation.
//
// Template selection: moveNumber % templates.length (deterministic variety).
// =============================================================================

import type { CoachingTemplate, SituationTemplates, TacticalSituation } from './types'

// =============================================================================
// Base Templates (45 total: 15 situations x 3 variants each)
// =============================================================================

const TERRITORY_BUILDING: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-TB-01',
      text: '\uC88B\uC740 \uC790\uB9AC\uC5D0 \uB450\uC168\uC5B4\uC694! {spatial}\uC5D0 \uC9D1\uC744 \uB9CC\uB4E4\uAE30 \uC88B\uC740 \uC704\uCE58\uC785\uB2C8\uB2E4. \uD604\uC7AC \uC2B9\uB960\uC740 {winrate}%\uC608\uC694.',
      slots: ['spatial', 'winrate'],
    },
    {
      id: 'C-TB-02',
      text: '{spatial} \uCABD\uC73C\uB85C \uC601\uC5ED\uC744 \uB113\uD788\uACE0 \uC788\uB124\uC694! \uD604\uC7AC {score_lead}\uC9D1 \uCC28\uC774\uC608\uC694.',
      slots: ['spatial', 'score_lead'],
    },
    {
      id: 'C-TB-03',
      text: '\uC774 {spatial}\uC740(\uB294) \uC544\uC9C1 \uBE44\uC5B4 \uC788\uC5B4\uC11C \uCC28\uC9C0\uD558\uAE30 \uC88B\uC544\uC694. \uD3EC\uC11D\uC774 \uC798 \uC9C4\uD589\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4!',
      slots: ['spatial'],
    },
  ],
}

const APPROACH: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-AP-01',
      text: '\uC0C1\uB300 \uB3CC\uC5D0 \uB2E4\uAC00\uAC00\uB294 \uC218\uB124\uC694. {spatial}\uC5D0\uC11C \uAC78\uCE58\uAE30(\uB2E4\uAC00\uAC00\uAE30)\uB294 \uD3EC\uC11D\uC758 \uAE30\uBCF8\uC774\uC5D0\uC694!',
      slots: ['spatial'],
    },
    {
      id: 'C-AP-02',
      text: '\uC0C1\uB300 {spatial} \uB3CC\uC5D0 \uC811\uADFC\uD588\uC5B4\uC694. \uC5EC\uAE30\uC11C AI\uC758 \uCD94\uCC9C\uC740 {best_move}\uC774\uACE0, \uADF8 \uB2E4\uC74C \uD750\uB984\uC740 {pv_short}\uC785\uB2C8\uB2E4.',
      slots: ['spatial', 'best_move', 'pv_short'],
    },
    {
      id: 'C-AP-03',
      text: '\uC88B\uC740 \uC811\uADFC\uC774\uC5D0\uC694! \uC0C1\uB300 \uB3CC \uAC00\uAE4C\uC774\uC5D0 \uB450\uBA74\uC11C \uC11C\uB85C\uC758 \uC601\uC5ED\uC744 \uB098\uB204\uAE30 \uC2DC\uC791\uD588\uC5B4\uC694.',
      slots: [],
    },
  ],
}

const ATTACK: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-AT-01',
      text: '\uACF5\uACA9\uC801\uC778 \uC218\uC785\uB2C8\uB2E4! \uC0C1\uB300 \uB3CC\uC758 \uD65C\uB85C\uAC00 {opponent_liberties}\uAC1C\uBC16\uC5D0 \uC548 \uB0A8\uC558\uC5B4\uC694. \uACC4\uC18D \uC555\uBC15\uD574 \uBCF4\uC138\uC694!',
      slots: ['opponent_liberties'],
    },
    {
      id: 'C-AT-02',
      text: '\uC0C1\uB300 \uB3CC\uC774 \uC704\uD5D8\uD574\uC9C0\uACE0 \uC788\uC5B4\uC694. \uD65C\uB85C\uAC00 {opponent_liberties}\uAC1C\uBFD0\uC774\uC5D0\uC694. \uC2B9\uB960\uC740 {winrate}%\uC785\uB2C8\uB2E4.',
      slots: ['opponent_liberties', 'winrate'],
    },
    {
      id: 'C-AT-03',
      text: '\uC88B\uC740 \uACF5\uACA9\uC774\uC5D0\uC694! \uC0C1\uB300 \uB3CC\uC744 \uBAB0\uC544\uBD99\uC774\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC774\uB807\uAC8C \uD65C\uB85C\uB97C \uC904\uC5EC\uAC00\uB294 \uAC8C \uC911\uC694\uD574\uC694.',
      slots: [],
    },
  ],
}

const ESCAPE: SituationTemplates = {
  emotion: 'cautionary',
  templates: [
    {
      id: 'C-ES-01',
      text: '\uC6B0\uB9AC \uB3CC\uC774 \uC704\uD5D8\uD574\uC694! \uD65C\uB85C\uAC00 {liberties}\uAC1C\uBC16\uC5D0 \uC548 \uB0A8\uC558\uC5B4\uC694. \uB3C4\uB9DD\uAC00\uAC70\uB098 \uC5F0\uACB0\uD560 \uACF3\uC744 \uCC3E\uC544\uC57C \uD574\uC694.',
      slots: ['liberties'],
    },
    {
      id: 'C-ES-02',
      text: '\uC870\uC2EC\uD558\uC138\uC694! \uC6B0\uB9AC \uB3CC\uC774 \uB458\uB7EC\uC2F8\uC774\uACE0 \uC788\uC5B4\uC694. \uD65C\uB85C\uAC00 {liberties}\uAC1C \uB0A8\uC558\uC73C\uB2C8 \uC548\uC804\uD55C \uAE38\uC744 \uCC3E\uC544\uBCF4\uC138\uC694.',
      slots: ['liberties'],
    },
    {
      id: 'C-ES-03',
      text: '\uAE34\uAE09\uD55C \uC0C1\uD669\uC774\uC5D0\uC694. \uC6B0\uB9AC \uB3CC\uC758 \uD65C\uB85C\uAC00 \uC801\uC5B4\uC11C \uC7A1\uD790 \uC218\uB3C4 \uC788\uC5B4\uC694. AI\uB294 {best_move}\uC744(\uB97C) \uCD94\uCC9C\uD574\uC694.',
      slots: ['best_move'],
    },
  ],
}

const CONNECTION: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-CN-01',
      text: '\uB3CC\uC744 \uC798 \uC5F0\uACB0\uD588\uC5B4\uC694! \uC5F0\uACB0\uD558\uBA74 \uB354 \uD2BC\uD2BC\uD574\uC838\uC694. \uC2B9\uB960\uC740 {winrate}%\uC785\uB2C8\uB2E4.',
      slots: ['winrate'],
    },
    {
      id: 'C-CN-02',
      text: '\uC88B\uC740 \uC5F0\uACB0\uC774\uC5D0\uC694! \uB450 \uB3CC \uADF8\uB8F9\uC744 \uC774\uC73C\uBA74 \uD6E8\uC52C \uC548\uC804\uD558\uACE0 \uAC15\uD574\uC9D1\uB2C8\uB2E4.',
      slots: [],
    },
    {
      id: 'C-CN-03',
      text: '\uC6B0\uB9AC \uB3CC\uB07C\uB9AC \uC5F0\uACB0\uD588\uB124\uC694. \uC774\uB807\uAC8C \uC774\uC5B4\uC9C0\uBA74 \uC0C1\uB300\uAC00 \uB04A\uAE30 \uC5B4\uB824\uC6CC\uC838\uC694. \uC798\uD558\uACE0 \uC788\uC5B4\uC694!',
      slots: [],
    },
  ],
}

const INVASION: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-IN-01',
      text: '\uC0C1\uB300 \uC601\uC5ED\uC5D0 \uCE68\uC785\uD558\uB294 \uC218\uC785\uB2C8\uB2E4! \uB300\uB2F4\uD55C \uC120\uD0DD\uC774\uC5D0\uC694. \uD604\uC7AC \uC2B9\uB960\uC740 {winrate}%\uC608\uC694.',
      slots: ['winrate'],
    },
    {
      id: 'C-IN-02',
      text: '\uC0C1\uB300 \uCABD\uC5D0 \uB4E4\uC5B4\uAC14\uC5B4\uC694! \uCE68\uC785\uC740 \uC704\uD5D8\uD558\uC9C0\uB9CC, \uC131\uACF5\uD558\uBA74 \uD070 \uC774\uB4DD\uC774\uC5D0\uC694. AI \uCD94\uCC9C\uC740 {best_move}\uC785\uB2C8\uB2E4.',
      slots: ['best_move'],
    },
    {
      id: 'C-IN-03',
      text: '\uACFC\uAC10\uD55C \uCE68\uC785\uC774\uC5D0\uC694! \uC0C1\uB300 \uC601\uC5ED\uC744 \uC904\uC774\uB824\uB294 \uC88B\uC740 \uC2DC\uB3C4\uC785\uB2C8\uB2E4. \uC774\uC81C \uC0B4\uC544\uB0A8\uB294 \uAC8C \uC911\uC694\uD574\uC694.',
      slots: [],
    },
  ],
}

const DEFENSE: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-DF-01',
      text: '\uC6B0\uB9AC \uC601\uC5ED\uC744 \uC798 \uC9C0\uD0A4\uACE0 \uC788\uC5B4\uC694! \uC0C1\uB300\uAC00 \uAC00\uAE4C\uC774 \uC654\uC73C\uB2C8 \uBC29\uC5B4\uAC00 \uC911\uC694\uD569\uB2C8\uB2E4.',
      slots: [],
    },
    {
      id: 'C-DF-02',
      text: '\uC88B\uC740 \uC218\uBE44\uC608\uC694. \uC6B0\uB9AC \uC9D1\uC744 \uD2BC\uD2BC\uD558\uAC8C \uB9CC\uB4E4\uACE0 \uC788\uC5B4\uC694. \uC2B9\uB960\uC740 {winrate}%\uC785\uB2C8\uB2E4.',
      slots: ['winrate'],
    },
    {
      id: 'C-DF-03',
      text: '\uC601\uC5ED \uBC29\uC5B4\uAC00 \uC798 \uB418\uACE0 \uC788\uC5B4\uC694. \uC0C1\uB300\uC758 \uCE68\uC785\uC5D0 \uB300\uBE44\uD558\uB294 \uAC74 \uC544\uC8FC \uC911\uC694\uD55C \uC2B5\uAD00\uC774\uC5D0\uC694!',
      slots: [],
    },
  ],
}

const CAPTURE: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-CP-01',
      text: '\uC0C1\uB300 \uB3CC\uC744 \uC7A1\uC744 \uC218 \uC788\uC5B4\uC694! \uD65C\uB85C\uAC00 1\uAC1C\uBC16\uC5D0 \uC548 \uB0A8\uC558\uC5B4\uC694. {capture_count}\uAC1C\uC758 \uB3CC\uC744 \uB530\uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4!',
      slots: ['capture_count'],
    },
    {
      id: 'C-CP-02',
      text: '\uB2E8\uC218(\uD65C\uB85C 1\uAC1C)\uC5D0\uC694! \uC0C1\uB300 \uB3CC {capture_count}\uAC1C\uB97C \uC7A1\uC744 \uC218 \uC788\uB294 \uC88B\uC740 \uAE30\uD68C\uC608\uC694!',
      slots: ['capture_count'],
    },
    {
      id: 'C-CP-03',
      text: '\uC0C1\uB300 \uB3CC\uC744 \uC7A1\uC744 \uAE30\uD68C\uC785\uB2C8\uB2E4! \uC2B9\uB960 {winrate}%\uB85C \uC720\uB9AC\uD55C \uC0C1\uD669\uC774\uC5D0\uC694.',
      slots: ['winrate'],
    },
  ],
}

const ENDGAME_COUNTING: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-EC-01',
      text: '\uB05D\uB0B4\uAE30\uC5D0 \uB4E4\uC5B4\uC654\uC5B4\uC694. \uC774\uC81C \uD55C \uC9D1 \uD55C \uC9D1\uC774 \uC911\uC694\uD569\uB2C8\uB2E4! \uD604\uC7AC {score_lead}\uC9D1 \uCC28\uC774\uC608\uC694.',
      slots: ['score_lead'],
    },
    {
      id: 'C-EC-02',
      text: '\uB05D\uB0B4\uAE30 \uB2E8\uACC4\uC785\uB2C8\uB2E4. \uACBD\uACC4\uC120\uC744 \uC798 \uB9C8\uBB34\uB9AC\uD558\uBA74 \uC2B9\uB9AC\uAC00 \uAC00\uAE4C\uC6CC\uC838\uC694. \uC2B9\uB960 {winrate}%!',
      slots: ['winrate'],
    },
    {
      id: 'C-EC-03',
      text: '\uB9C8\uBB34\uB9AC \uB2E8\uACC4\uC608\uC694! AI\uB294 {best_move}\uC744(\uB97C) \uCD94\uCC9C\uD574\uC694. \uB0A8\uC740 \uACF3\uC744 \uD558\uB098\uC529 \uCC59\uACA8\uBCF4\uC138\uC694.',
      slots: ['best_move'],
    },
  ],
}

const BRILLIANT_MOVE: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-BR-01',
      text: '\uC640, \uBBD8\uC218\uC785\uB2C8\uB2E4! AI\uB3C4 \uC608\uC0C1\uD558\uC9C0 \uBABB\uD55C \uB6F0\uC5B4\uB09C \uC218\uC608\uC694! \uC815\uB9D0 \uB300\uB2E8\uD574\uC694!',
      slots: [],
    },
    {
      id: 'C-BR-02',
      text: '\uB180\uB77C\uC6B4 \uC218\uC785\uB2C8\uB2E4! \uC774\uB7F0 \uC218\uB294 \uD504\uB85C \uAE30\uC0AC\uB3C4 \uCE6D\uCC2C\uD560 \uB9CC\uD574\uC694. \uC2B9\uB960 {winrate}%\uB85C \uCD5C\uACE0\uC758 \uC120\uD0DD\uC774\uC5D0\uC694!',
      slots: ['winrate'],
    },
    {
      id: 'C-BR-03',
      text: '\uBA4B\uC9C4 \uBC1C\uACAC\uC774\uC5D0\uC694! AI\uC758 \uCCAB \uBC88\uC9F8 \uD6C4\uBCF4\uAC00 \uC544\uB2C8\uC5C8\uB294\uB370, \uAE4A\uC774 \uC77D\uC5B4\uBCF4\uB2C8 \uCD5C\uC120\uC774\uC5C8\uC5B4\uC694. \uAC10\uAC01\uC774 \uC88B\uC73C\uC2DC\uB124\uC694!',
      slots: [],
    },
  ],
}

const GOOD_MOVE: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-GM-01',
      text: '\uC88B\uC740 \uC218\uC785\uB2C8\uB2E4! AI \uCD94\uCC9C\uACFC \uAC19\uC740 \uC790\uB9AC\uC5D0 \uB450\uC168\uC5B4\uC694. \uC2B9\uB960 {winrate}%!',
      slots: ['winrate'],
    },
    {
      id: 'C-GM-02',
      text: '\uC798 \uB450\uC168\uC5B4\uC694! \uC774 \uC218\uB294 AI\uAC00 \uAC00\uC7A5 \uCD94\uCC9C\uD558\uB294 \uC218\uC785\uB2C8\uB2E4. \uD604\uC7AC {score_lead}\uC9D1 \uCC28\uC774\uC608\uC694.',
      slots: ['score_lead'],
    },
    {
      id: 'C-GM-03',
      text: '\uC88B\uC740 \uC120\uD0DD\uC774\uC5D0\uC694! \uC774\uB807\uAC8C \uB450\uBA74 \uD750\uB984\uC774 \uC88B\uC544\uC694. \uB2E4\uC74C\uC740 {pv_short} \uBC29\uD5A5\uC73C\uB85C \uC9C4\uD589\uB420 \uC218 \uC788\uC5B4\uC694.',
      slots: ['pv_short'],
    },
  ],
}

const MISTAKE: SituationTemplates = {
  emotion: 'encouraging',
  templates: [
    {
      id: 'C-MK-01',
      text: '\uC774 \uC218\uB294 \uC870\uAE08 \uC544\uC26C\uC6CC\uC694. \uC2B9\uB960\uC774 {winrate_delta}% \uB5A8\uC5B4\uC84C\uC5B4\uC694. \uD558\uC9C0\uB9CC \uC544\uC9C1 \uAE30\uD68C\uB294 \uC788\uC73C\uB2C8 \uAC71\uC815 \uB9C8\uC138\uC694!',
      slots: ['winrate_delta'],
    },
    {
      id: 'C-MK-02',
      text: '\uC5EC\uAE30\uC11C\uB294 {best_move}\uC774(\uAC00) \uB354 \uC88B\uC558\uC744 \uAC70\uC608\uC694. \uC2B9\uB960\uC774 {winrate_delta}% \uBCC0\uD588\uC9C0\uB9CC, \uBC14\uB451\uC740 \uB05D\uB0A0 \uB54C\uAE4C\uC9C0 \uBAA8\uB974\uB294 \uAC70\uC608\uC694!',
      slots: ['best_move', 'winrate_delta'],
    },
    {
      id: 'C-MK-03',
      text: '\uC2E4\uC218\uB294 \uBC30\uC6C0\uC758 \uC2DC\uC791\uC774\uC5D0\uC694! AI \uCD94\uCC9C\uC740 {best_move}\uC774\uC5C8\uC5B4\uC694. \uB2E4\uC74C\uC5D0\uB294 \uC774\uB7F0 \uC790\uB9AC\uB97C \uC0B4\uD3B4\uBCF4\uC138\uC694.',
      slots: ['best_move'],
    },
  ],
}

const MOMENTUM_SHIFT: SituationTemplates = {
  emotion: 'positive',
  templates: [
    {
      id: 'C-MS-01',
      text: '\uD750\uB984\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694! \uC2B9\uB960\uC774 {winrate}%\uB85C \uBCC0\uD588\uC2B5\uB2C8\uB2E4. \uC911\uC694\uD55C \uC804\uD658\uC810\uC774\uC5D0\uC694!',
      slots: ['winrate'],
    },
    {
      id: 'C-MS-02',
      text: '\uAD6D\uBA74\uC774 \uC804\uD658\uB418\uACE0 \uC788\uC5B4\uC694! \uD604\uC7AC \uC2B9\uB960 {winrate}%, {score_lead}\uC9D1 \uCC28\uC774\uC785\uB2C8\uB2E4.',
      slots: ['winrate', 'score_lead'],
    },
    {
      id: 'C-MS-03',
      text: '\uD310\uC138\uAC00 \uC6C0\uC9C1\uC774\uACE0 \uC788\uC5B4\uC694. \uC774\uB7F0 \uC21C\uAC04\uC5D0 \uC9D1\uC911\uD558\uB294 \uAC8C \uC911\uC694\uD569\uB2C8\uB2E4! \uC2B9\uB960 {winrate}%.',
      slots: ['winrate'],
    },
  ],
}

const CLOSE_GAME: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-CG-01',
      text: '\uD33D\uD33D\uD55C \uC811\uC804\uC774\uC5D0\uC694! \uC2B9\uB960 {winrate}%\uB85C \uC5B4\uB290 \uCABD\uB3C4 \uC548\uC2EC\uD560 \uC218 \uC5C6\uC5B4\uC694. \uD55C \uC218 \uD55C \uC218\uAC00 \uC911\uC694\uD569\uB2C8\uB2E4!',
      slots: ['winrate'],
    },
    {
      id: 'C-CG-02',
      text: '\uC544\uC8FC \uBE44\uC2B7\uD55C \uB300\uAD6D\uC774\uC5D0\uC694. {score_lead}\uC9D1 \uCC28\uC774\uBC16\uC5D0 \uC548 \uB098\uC694. \uC9D1\uC911\uD574\uC11C \uCD5C\uC120\uC744 \uB2E4\uD558\uC138\uC694!',
      slots: ['score_lead'],
    },
    {
      id: 'C-CG-03',
      text: '\uD638\uAC01\uC138! \uC591\uCABD \uB2E4 \uC2B9\uBD80\uB97C \uAC78 \uC218 \uC788\uB294 \uC0C1\uD669\uC774\uC5D0\uC694. AI \uCD94\uCC9C\uC740 {best_move}\uC785\uB2C8\uB2E4.',
      slots: ['best_move'],
    },
  ],
}

const POSITIONAL: SituationTemplates = {
  emotion: 'neutral',
  templates: [
    {
      id: 'C-PS-01',
      text: '{game_phase} \uB2E8\uACC4\uC785\uB2C8\uB2E4. \uD604\uC7AC \uC2B9\uB960 {winrate}%, {score_lead}\uC9D1 \uCC28\uC774\uC608\uC694.',
      slots: ['game_phase', 'winrate', 'score_lead'],
    },
    {
      id: 'C-PS-02',
      text: '\uCC28\uBD84\uD55C \uC9C4\uD589\uC774\uC5D0\uC694. \uD604\uC7AC \uC2B9\uB960\uC740 {winrate}%\uC774\uACE0, AI\uB294 {best_move}\uC744(\uB97C) \uCD94\uCC9C\uD574\uC694.',
      slots: ['winrate', 'best_move'],
    },
    {
      id: 'C-PS-03',
      text: '\uD55C \uC218 \uD55C \uC218 \uCC29\uC2E4\uD558\uAC8C \uB450\uACE0 \uC788\uC5B4\uC694. \uD604\uC7AC {score_lead}\uC9D1 \uCC28\uC774\uB85C \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.',
      slots: ['score_lead'],
    },
  ],
}

// =============================================================================
// Situation Catalog: maps TacticalSituation -> SituationTemplates
// =============================================================================

export const COACHING_CATALOG: Readonly<Record<TacticalSituation, SituationTemplates>> = {
  territory_building: TERRITORY_BUILDING,
  approach: APPROACH,
  attack: ATTACK,
  escape: ESCAPE,
  connection: CONNECTION,
  invasion: INVASION,
  defense: DEFENSE,
  capture: CAPTURE,
  endgame_counting: ENDGAME_COUNTING,
  brilliant_move: BRILLIANT_MOVE,
  good_move: GOOD_MOVE,
  mistake: MISTAKE,
  momentum_shift: MOMENTUM_SHIFT,
  close_game: CLOSE_GAME,
  positional: POSITIONAL,
}

// =============================================================================
// Encouragement Suffix Templates (7 total: 3 streak + 2 recovery + 2 momentum)
// =============================================================================

export interface SuffixTemplateGroup {
  readonly templates: readonly CoachingTemplate[]
}

export const STREAK_SUFFIXES: SuffixTemplateGroup = {
  templates: [
    {
      id: 'C-SK-01',
      text: ' \uC5F0\uC18D {consecutive_count}\uC218\uC9F8 \uC88B\uC740 \uC218\uC785\uB2C8\uB2E4! \uB300\uB2E8\uD574\uC694!',
      slots: ['consecutive_count'],
    },
    {
      id: 'C-SK-02',
      text: ' {consecutive_count}\uC218 \uC5F0\uC18D \uC88B\uC740 \uC120\uD0DD! \uC774 \uD750\uB984\uC744 \uC774\uC5B4\uAC00\uC138\uC694!',
      slots: ['consecutive_count'],
    },
    {
      id: 'C-SK-03',
      text: ' \uBC8C\uC368 {consecutive_count}\uBC88\uC9F8 \uC88B\uC740 \uC218! \uC2E4\uB825\uC774 \uB290\uB294 \uAC8C \uBCF4\uC5EC\uC694!',
      slots: ['consecutive_count'],
    },
  ],
}

export const RECOVERY_SUFFIXES: SuffixTemplateGroup = {
  templates: [
    {
      id: 'C-RC-01',
      text: ' \uC774\uC804 \uC2E4\uC218\uB97C \uB9CC\uD68C\uD558\uB294 \uC88B\uC740 \uC218\uC785\uB2C8\uB2E4!',
      slots: [],
    },
    {
      id: 'C-RC-02',
      text: ' \uBA4B\uC9C4 \uD68C\uBCF5\uC774\uC5D0\uC694! \uC774\uB807\uAC8C \uB2E4\uC2DC \uC77C\uC5B4\uC11C\uB294 \uAC8C \uC911\uC694\uD569\uB2C8\uB2E4.',
      slots: [],
    },
  ],
}

export const MOMENTUM_SUFFIXES: SuffixTemplateGroup = {
  templates: [
    {
      id: 'C-MO-01',
      text: ' \uD750\uB984\uC774 \uBC14\uB00C\uACE0 \uC788\uC5B4\uC694!',
      slots: [],
    },
    {
      id: 'C-MO-02',
      text: ' \uC774\uC81C \uC8FC\uB3C4\uAD8C\uC744 \uC7A1\uC558\uC2B5\uB2C8\uB2E4!',
      slots: [],
    },
  ],
}
