// Figma rzbdoke4PKo2QHapufEf7g. Content fixture only; renderers have no heritage-specific text or assets.
const root = '/docent/template1/sample/';
const image = (id, file, x, y, width, height, extra = {}) => ({ id, imageUrl: root + file, x, y, width, height, ...extra });
const pedestal = (x = 41, y = 337, width = 311, height = 241) => image('pedestal', 'pedestal.png', x, y, width, height, { glow: true });
const svg = (id, file, x, y, width, height, extra) => image(id, file, x, y, width, height, { intrinsic: true, ...extra });
const transition = (durationMs = 300, easing = 'ease-in-out') => ({ type: 'smart', durationMs, easing });
const scene = (id, layers, durationMs = 300, easing = 'ease-in-out') => ({ id, layers, advance: 'click', transition: transition(durationMs, easing) });
const stones = (exploded) => [
  image('lower', 'pedestal-lower.png', -20.5, exploded ? 362 : 360, 425, 282, { glow: true, cropY: exploded ? 0 : -17.3 }),
  image('middle', 'pedestal-middle.png', -20.5, 311, 425, 282, { glow: true }),
  image('upper', 'pedestal-upper.png', -20.5, exploded ? 270 : 311, 425, 282, { glow: true }),
];

export const docentTemplate1Sample = {
  templateType: 'template_1', title: '부처님 있어요? 아뇨 없어요.', subtitle: '사라진 불상은 어떻게 생겼을까?',
  backgroundUrl: root + 'background.png', resultLayers: [pedestal(20, 250, 349, 270)], selectionLayers: [pedestal()],
  returnTransition: transition(200),
  topics: [
    { id: 'buddha', label: '텍스트 1', title: '이 위에 부처님이?', subtitle: '사라진 불상은 어떻게 생겼을까?', x: 161, y: 275,
      script: '불상의 자세는 4가지가 있습니다. 가부좌, 반가부좌, 누운 자세, 서 있는 자세가 있습니다. 금산사 석련대는 왜 서 있는 자세로 추정했을까요? 바로 중대석의 길이와 홈을 통해 알 수 있습니다. 앉은 자세의 경우 중간석이 길며 따로 결구를 제작하지 않는 경우가 많습니다. 돌로 만들어진 앉은 자세의 경우 그 자체만으로도 안정감을 가지기 때문입니다. 입상의 경우 중대석을 짧거나 없이 조각하여 비례를 맞추고 양발에 결구를 맞추어 균형을 유지합니다.',
      returnTransition: transition(200), scenes: [
        scene('seated', [pedestal(98.91, 542.42, 190.99, 147.58), svg('seated', 'buddha-seated.svg', 101.01, 304, 196.848, 252.809)]),
        scene('half-seated', [pedestal(99.02, 541.94, 190.96, 147.56), svg('half-seated', 'buddha-half-seated.svg', 105.24, 281, 183.245, 423.987)], 300, 'ease-out'),
        scene('reclining', [svg('reclining', 'buddha-reclining.svg', 13.24, 393, 365.751, 176)], 300, 'ease-out'),
        scene('standing', [pedestal(99.02, 542.44, 190.96, 147.56), svg('standing', 'buddha-standing.svg', 129.76, 228.67, 126.438, 338.505)], 300, 'ease-out'),
        scene('joints', [pedestal(31, 346, 327, 252), svg('joints', 'joints.svg', 145.5, 365.03, 87.5, 74.8575),
          svg('joint-arrow', 'joint-arrow.svg', 169.45, 274.74, 34.0198, 92.8979, { rotation: -160.2 }),
          { id: 'joint-label', text: '결구', x: 223, y: 264, width: 37, height: 24, fontSize: 20 }], 200),
      ] },
    { id: 'dating', label: '텍스트 2', title: '통째로 조각된 3단구성의 유물', subtitle: '연대 추정', x: 20, y: 386,
      script: '기록이 없는 유물은 어떻게 시대를 가늠할까요? 유물의 연대를 측정하는 방식에는 과학을 활용한 절대연대측정과, 연대가 도출된 다른 유물과 비교하여 시대를 가늠하는 상대연대 측정법 등이 있습니다. 금산사 석련대는 통일신라시대의 삼단 팔각 연화좌대 형식과 비슷한 3단 형식의 구성을 보여주고 있습니다. 중대 6각, 하대 10각으로 이루어져 있으며 고려시대의 특징인 중대 안상 조각과 자유롭고 화려한 조형미를 보여주고 있습니다.',
      returnTransition: transition(200), scenes: [scene('assembled', stones(false), 100, 'ease-out'), scene('exploded', stones(true))] },
    { id: 'making', label: '텍스트 3', title: '화강암으로 조각된 아름다움', subtitle: '어떻게 만들어졌을까?', x: 145, y: 596,
      script: '우리나라의 돌 조각은 화강암으로 이루어져 있습니다. 화강암은 석영, 장석, 운모 등 다양한 광물질이 혼합 구성됩니다. 그 때문에 서양의 대리석보다 조각하기에 딱딱하고 쪼개짐을 예상하기 어렵다는 특징이 있습니다. 그럼에도 금산사 석련대는 연꽃의 볼륨을 살려 율동감이 느껴집니다. 또한 하대의 너비를 풍만하게 조성하여 비례를 살렸습니다.',
      returnTransition: transition(300), scenes: [scene('making-intro', [pedestal()]),
        scene('stone-comparison', [pedestal(43, 410),
          { id: 'marble-label', text: '대리석', x: 74, y: 250, width: 56, height: 24, fontSize: 20, fontWeight: 400 },
          { id: 'granite-label', text: '화강암', x: 264, y: 250, width: 56, height: 24, fontSize: 20, fontWeight: 400 },
          image('marble', 'marble.png', -8, 285, 172, 129, { mask: root + 'stone-mask.svg', maskX: 51, maskY: -2, maskSize: 118.087 }),
          svg('marble-ring', 'stone-ring.svg', 43, 283, 118.087, 118.087),
          image('granite', 'granite.png', 184.1, 298.3, 161.981, 127.08, { mask: root + 'stone-mask.svg', maskX: 46.9, maskY: -15.3, maskSize: 118.087 }),
          svg('granite-ring', 'stone-ring.svg', 231, 283, 118.087, 118.087),
          svg('comparison', 'comparison.svg', 190, 329, 13, 27),
        ]), scene('lotus', [pedestal(), svg('lotus', 'lotus.svg', 108, 392, 162.939, 85.5688)])] },
  ],
};
