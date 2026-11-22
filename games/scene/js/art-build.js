/* Scene Maker art: the building site. A backdrop and the construction
   category: the machines (all facing right, so Flip turns them round),
   the crew and the site bits. Uses the helpers in SceneArt.h. */
(function (A) {
  'use strict';
  var h = A.h, P = h.P, C = h.C, E = h.E, R = h.R, N = h.N, G = h.G, sw = h.sw, st = h.st, op = h.op,
      tube = h.tube, wheel = h.wheel, track = h.track, shine = h.shine, f = h.f;
  var Y = '#ffc21a', YD = '#e09a00', DK = '#3b3350', MT = '#8d93b0', ML = '#c9cde3', GL = '#bfe9ff', RU = '#ff7a45';
  var def = A.def;
  function win(d) { return P(d, GL) ; }
  /* a truck cab facing right, front bumper at x 94 */
  function cab(x) {
    return P('M' + x + ' 62V34Q' + x + ' 30 ' + (x + 4) + ' 30H' + (x + 18) + 'Q' + (x + 23) + ' 30 ' + (x + 25) + ' 36L94 50V62z', Y) +
      win('M' + (x + 6) + ' 35H' + (x + 17) + 'Q' + (x + 20) + ' 35 ' + (x + 21) + ' 38L' + (x + 26) + ' 49H' + (x + 6) + 'z') +
      shine(x + 10, 40, 2, 4, 20) + R(87, 57, 9, 6, 2, MT) + E(93, 53, 1.6, 2.6, '#fff7c2', sw(1.5));
  }

  def('excavator', 'Digger', 'build', 0.26, 'ground', 'dig', 'rumble', 'rock', function () {
    return track(6, 72, 60, 18, 5) +
      R(14, 64, 46, 9, 3, '#5a5570') +
      R(17, 29, 4, 13, 1, DK) +
      P('M8 64V46Q8 40 14 40H58V64z', Y) + N(R(10, 57, 46, 3, 1, YD)) + P('M13 47h9M13 51h9', 'none', st(YD, 2)) +
      P('M33 64V24Q33 20 37 20H53Q57 20 57 24V64z', Y) + win('M37 24H53V44H37z') + shine(41, 30, 2, 5, 15) +
      P('M50 60Q58 32 74 13L84 20Q69 37 62 62z', Y) + P('M54 50L70 28', 'none', st(ML, 3.5)) +
      P('M75 12L84 10L95 50L87 53z', Y) + P('M84 22L92 44', 'none', st(ML, 3)) +
      P('M84 48L99 52L96 68Q89 77 80 68z', MT) + P('M82 70l-2 4.5M87 73.5l-1 4.5M92 71l1 4.5', 'none', sw(2.6)) +
      C(79, 16, 3, ML) + C(90, 51, 3, ML) + C(56, 58, 3, ML);
  });
  def('bulldozer', 'Bulldozer', 'build', 0.26, 'ground', 'rock', 'rumble', 'rock', function () {
    return track(8, 68, 62, 22, 5) +
      tube('M12 64L4 70L6 84', MT, 4) +
      R(54, 30, 4, 16, 1, DK) +
      R(14, 46, 34, 24, 4, Y) + R(40, 44, 30, 24, 3, Y) + P('M46 50v12M52 50v12M58 50v12', 'none', st(YD, 2.4)) +
      R(12, 15, 34, 6, 2, Y) + R(14, 20, 30, 28, 3, Y) + win('M18 24H40V42H18z') + shine(22, 29, 2, 5, 15) +
      tube('M64 74L80 70', MT, 5) + tube('M64 52L80 46', MT, 4) +
      P('M76 30Q90 58 76 90L94 91Q100 60 90 28z', YD) + P('M76 90L94 91', 'none', st(ML, 4)) +
      N(P('M84 34Q94 58 84 86', 'none', st('#ffd76a', 3.5)));
  });
  def('dumptruck', 'Dump truck', 'build', 0.26, 'ground', 'tip', 'rumble', 'rock', function () {
    return P('M12 38Q22 16 36 27Q46 14 60 38z', '#a0714f') + N(C(28, 30, 3, '#8a5a35') + C(46, 28, 2.6, '#8a5a35') + C(38, 22, 2, '#c99a6a')) +
      P('M8 36L62 36L58 62L14 62z', Y) + P('M22 36L21 62M36 36V62M50 36L49 62', 'none', st(YD, 2.5)) + N(R(10, 37, 50, 3, 1, '#fff', op(0.35))) +
      R(10, 60, 84, 9, 2, DK) +
      cab(62) +
      wheel(24, 74, 11, ML) + wheel(48, 74, 11, ML) + wheel(80, 74, 11, ML);
  });
  def('towercrane', 'Tower crane', 'build', 0.32, 'ground', 'lift', 'beep', 'sway', function () {
    var zig = 'M18 16'; for (var i = 0; i < 15; i++) zig += 'l2.5 7l2.5-7';
    return R(20, 88, 30, 8, 2, MT) +
      R(30, 26, 10, 64, 0, Y) + P('M30 30L40 38L30 46L40 54L30 62L40 70L30 78L40 86', 'none', sw(2)) +
      P('M30 16L35 3L40 16z', Y) + P('M35 3L94 16M35 3L14 16', 'none', sw(1.6)) +
      R(14, 16, 82, 7, 0, Y) + P(zig, 'none', sw(1.6)) +
      R(12, 23, 15, 12, 1, MT) + N(P('M14 27h11M14 31h11', 'none', st(ML, 1.6))) +
      R(39, 23, 13, 11, 2, Y) + R(42, 25, 7, 6, 1, GL, sw(1.5)) +
      R(70, 23, 10, 4, 1, DK) + P('M75 27V56', 'none', sw(1.6)) + R(72, 55, 6, 5, 1, DK) +
      P('M75 60L63 69M75 60L87 69', 'none', sw(1.5)) + R(58, 68, 34, 7, 1, RU) + N(R(60, 70, 30, 1.6, 0, '#ffb08a'));
  });
  def('mobilecrane', 'Crane truck', 'build', 0.28, 'ground', 'lift', 'beep', 'rock', function () {
    return P('M10 70V84M90 70V84', 'none', st(MT, 4)) + R(4, 83, 14, 4, 1, DK) + R(83, 83, 14, 4, 1, DK) +
      R(6, 58, 88, 12, 3, Y) + N(R(8, 62, 84, 2.4, 1, YD)) +
      wheel(23, 73, 9, ML) + wheel(41, 73, 9, ML) + wheel(63, 73, 9, ML) + wheel(80, 73, 9, ML) +
      R(20, 46, 36, 14, 3, Y) +
      P('M26 54L80 7L87 14L34 60z', Y) + P('M54 30L60 37', 'none', sw(2)) + N(P('M32 54L80 12', 'none', st('#ffd76a', 2.5))) +
      P('M83 11V38', 'none', sw(1.6)) + R(80, 38, 6, 6, 1, DK) + P('M83 44q0 6-4 6q-3 0-3-3', 'none', sw(2.4)) +
      R(44, 36, 14, 18, 2, Y) + R(47, 39, 8, 9, 1, GL, sw(1.5)) +
      P('M75 58V44Q75 40 79 40H90Q94 40 94 46V58z', Y) + R(79, 44, 10, 8, 1, GL, sw(1.5));
  });
  def('mixer', 'Cement mixer', 'build', 0.26, 'ground', 'rock', 'churn', 'rock', function () {
    var drum = 'M10 46Q12 26 34 24L60 30Q68 44 60 58L34 64Q12 64 10 46z';
    return R(8, 60, 86, 9, 2, DK) +
      tube('M12 56L4 66', MT, 4) +
      P('M30 64L34 58M56 58L58 64', 'none', st(MT, 4)) +
      P(drum, '#f4f2ff') + N(P('M22 28Q34 44 24 62M36 25Q48 44 38 64M50 28Q60 44 52 60', 'none', st(RU, 6))) + P(drum) +
      shine(32, 32, 9, 2.6, 8) + E(11, 45, 3, 9, MT) +
      cab(64) +
      wheel(24, 74, 11, ML) + wheel(46, 74, 11, ML) + wheel(80, 74, 11, ML);
  });
  def('loader', 'Front loader', 'build', 0.26, 'ground', 'dig', 'rumble', 'rock', function () {
    return R(12, 32, 4, 13, 1, DK) +
      P('M6 66V50Q6 44 12 44H50V66z', Y) + P('M10 50v12M15 50v12', 'none', st(YD, 2)) +
      R(46, 50, 24, 14, 3, Y) +
      P('M24 46V22Q24 18 28 18H46Q50 18 50 22V46z', Y) + win('M28 22H46V40H28z') + shine(32, 27, 2, 5, 15) +
      tube('M54 54L80 40', Y, 7) + P('M60 62L82 52', 'none', st(ML, 3.5)) +
      P('M73 22L97 29L95 61L80 61Q69 42 73 22z', YD) + P('M80 61H95', 'none', st(ML, 3.5)) + C(80, 40, 3, ML) +
      wheel(26, 74, 16, ML) + wheel(70, 74, 16, ML) +
      N(P('M14 74h-3M38 74h3M58 74h-3M82 74h3', 'none', st('#6b6788', 3)));
  });
  def('roller', 'Steamroller', 'build', 0.24, 'ground', 'rock', 'rumble', 'rock', function () {
    return R(53, 26, 4, 22, 1, DK) +
      R(12, 15, 42, 6, 2, Y) + R(15, 20, 4, 27, 1, DK) + R(47, 20, 4, 27, 1, DK) +
      R(10, 46, 52, 22, 4, Y) + N(R(12, 52, 48, 3, 1, YD)) +
      R(23, 38, 11, 9, 2, DK) + P('M38 40l6-5', 'none', sw(3)) + E(45, 34, 5, 2, DK) +
      wheel(24, 76, 13, ML) +
      P('M52 44H96V60H52z', Y) + N(R(54, 47, 40, 3, 1, YD)) +
      C(74, 68, 23, '#a9aec8') + P('M57 68A17 17 0 0 1 74 51', 'none', st('#e6e8f4', 3.5)) +
      C(74, 68, 13, 'none', st('#8d93b0', 2.5)) + C(74, 68, 4, YD, sw(2)) +
      P('M6 92H96', 'none', st(DK, 4));
  });
  def('forklift', 'Forklift', 'build', 0.22, 'ground', 'lift', 'beep', 'rock', function () {
    return P('M28 50V18H62V50', 'none', st(DK, 4)) + R(26, 15, 38, 5, 2, DK) +
      P('M10 76V58Q10 46 22 46H30V76z', YD) +
      R(22, 50, 46, 26, 4, Y) + N(R(24, 56, 42, 3, 1, YD)) +
      R(32, 40, 10, 11, 2, DK) + P('M52 47L58 37', 'none', sw(3)) + E(58, 36, 5, 2, DK) +
      R(69, 12, 7, 74, 1, MT) + R(74, 50, 6, 32, 1, DK) +
      R(76, 74, 22, 5, 1, '#c98a4a') + R(78, 52, 18, 22, 2, '#e0b070') + N(R(85, 52, 4, 22, 0, '#c98a4a')) +
      P('M76 81H98V86H76z', MT) +
      wheel(26, 79, 10) + wheel(60, 78, 11);
  });
  def('backhoe', 'Backhoe', 'build', 0.28, 'ground', 'dig', 'rumble', 'rock', function () {
    return tube('M22 64L14 81', MT, 4) + R(8, 81, 13, 4, 1, DK) +
      tube('M24 58L16 26', Y, 7) + tube('M16 26L8 49', Y, 5) + P('M2 48L13 48L11 59Q5 63 2 55z', MT) + C(16, 26, 2.6, ML) +
      R(64, 32, 4, 11, 1, DK) +
      R(22, 52, 60, 16, 4, Y) + P('M58 52V42H84Q88 42 88 46V52z', Y) + P('M66 45v6M72 45v6M78 45v6', 'none', st(YD, 2)) +
      R(26, 20, 28, 32, 3, Y) + win('M30 24H50V46H30z') + shine(34, 30, 2, 6, 15) +
      tube('M80 58L88 62', Y, 6) + P('M84 46L98 50L96 72L84 72Q79 58 84 46z', YD) + P('M85 72H96', 'none', st(ML, 3)) +
      wheel(36, 74, 16, ML) + wheel(74, 78, 11, ML);
  });

  /* the crew */
  def('worker', 'Builder', 'build', 0.16, 'ground', 'hop', 'hello', 'bob', function () {
    return h.person({ skin: '#f2c29a', hair: '#7a4a2a', style: 'short', top: '#4c7dff', vest: '#ff8a1f', legs: '#3b4a9a', shoes: '#6b4a2a', hat: 'hard', hatc: Y, hold: 'shovel' });
  });
  def('worker2', 'Builder with flag', 'build', 0.16, 'ground', 'hop', 'hello', 'bob', function () {
    return h.person({ skin: '#8d5a3b', hair: '#2b2020', style: 'short', top: '#5a6b8a', vest: '#c6f53a', legs: '#3b3350', shoes: '#6b4a2a', hat: 'hard', hatc: '#f4f2ff', hold: 'flag' });
  });
  def('worker3', 'Builder with hammer', 'build', 0.16, 'ground', 'hop', 'hello', 'bob', function () {
    return h.person({ skin: '#e0a878', hair: '#c94a2a', style: 'pigtails', top: '#3ddc84', vest: '#ff8a1f', legs: '#4c7dff', shoes: '#6b4a2a', hat: 'hard', hatc: '#ff8a1f', hold: 'hammer' });
  });

  /* site bits */
  def('cone', 'Traffic cone', 'build', 0.09, 'ground', 'wiggle', 'boing', '', function () {
    return R(18, 82, 64, 9, 3, '#ff7a2e') + P('M42 14H58L71 84H29z', '#ff7a2e') +
      P('M38.5 36H61.5L63.4 46H36.6zM35 56H65L66.9 66H33.1z', '#fff', sw(2)) + shine(44, 26, 1.6, 6, 0);
  });
  def('barrier', 'Barrier', 'build', 0.2, 'ground', 'wiggle', 'knock', '', function () {
    var s = P('M20 48L12 90M20 48L28 90M80 48L72 90M80 48L88 90', 'none', st(DK, 4)) + R(8, 30, 84, 18, 3, '#fff');
    [20, 40, 60, 80].forEach(function (x) { s += P('M' + x + ' 30h10l-8 18h-10z', '#ff5d4d', ' stroke="none"'); });
    return s + R(8, 30, 84, 18, 3) + R(44, 18, 12, 12, 3, '#ffb52e') + N(C(50, 24, 3, '#fff7c2')) + R(10, 58, 80, 7, 2, '#fff') + N(R(12, 60, 76, 3, 1, '#ff5d4d'));
  });
  def('dirtpile', 'Dirt pile', 'build', 0.22, 'ground', 'wiggle', 'rumble', '', function () {
    return P('M4 86Q18 52 38 46Q52 30 68 42Q88 52 96 86z', '#a0714f') +
      N(P('M30 58Q40 50 48 54M58 44Q66 44 72 50', 'none', st('#c99a6a', 3)) + C(36, 72, 4, '#8a5a35') + C(62, 66, 3.4, '#8a5a35') + C(78, 76, 3, '#8a5a35') + C(20, 80, 2.6, '#8a5a35') + C(52, 80, 3, '#7a4f2e'));
  });
  def('rocks', 'Rock pile', 'build', 0.18, 'ground', 'wiggle', 'knock', '', function () {
    return E(28, 76, 20, 14, '#9aa0bd') + E(72, 78, 20, 12, '#7f86a8') + E(52, 60, 18, 16, '#b3b8d0') + E(50, 84, 16, 9, '#8d93b0') +
      E(34, 56, 10, 8, '#8d93b0') + shine(46, 54, 5, 2.6, -20) + shine(22, 72, 5, 2.4, -20);
  });
  def('bricks', 'Bricks', 'build', 0.16, 'ground', 'hop', 'knock', '', function () {
    var s = R(8, 82, 84, 8, 1, '#c98a4a') + P('M14 90v6M50 90v6M86 90v6', 'none', st('#a0714f', 5)), B = '#e2583e';
    [[10, 70], [36, 70], [62, 70], [23, 58], [49, 58], [36, 46]].forEach(function (p) { s += R(p[0], p[1], 26, 12, 2, B) + N(R(p[0] + 3, p[1] + 2.5, 20, 2, 1, '#ff8a6e')); });
    return s;
  });
  def('beam', 'Steel beam', 'build', 0.24, 'ground', 'lift', 'clang', '', function () {
    return G(R(20, 40, 74, 22, 1, RU) + R(20, 37, 74, 6, 1, '#ff9a6a') + R(20, 59, 74, 6, 1, '#e8602c') +
      N(C(32, 51, 2.4, '#b8461c') + C(50, 51, 2.4, '#b8461c') + C(68, 51, 2.4, '#b8461c') + C(84, 51, 2.4, '#b8461c')) +
      P('M6 37H20V43H15V59H20V65H6V59H11V43H6z', '#ff9a6a'), 'rotate(-10 50 50)');
  });
  def('pipe', 'Big pipe', 'build', 0.2, 'ground', 'rock', 'clang', '', function () {
    return R(14, 38, 64, 40, 0, '#b8bdd6') + N(R(16, 42, 60, 5, 2, '#fff', op(0.4)) + R(16, 68, 60, 5, 2, '#8d93b0')) +
      E(14, 58, 8, 20, '#b8bdd6') + E(78, 58, 12, 20, '#c9cde3') + E(78, 58, 7, 13, DK) + P('M8 78H92', 'none', sw(3));
  });
  def('barrow', 'Wheelbarrow', 'build', 0.16, 'ground', 'tip', 'knock', '', function () {
    return tube('M30 58L6 50', MT, 4) + P('M36 62L33 84M58 66L70 74', 'none', st(MT, 4)) +
      P('M24 34Q40 26 56 30Q70 22 78 36z', '#a0714f') +
      P('M18 36H84L74 62H32z', '#3ddc84') + N(R(22, 39, 58, 3, 1, '#fff', op(0.4))) +
      wheel(70, 76, 11);
  });
  def('sign', 'Digging sign', 'build', 0.14, 'ground', 'wiggle', 'knock', '', function () {
    return P('M40 80L33 96M60 80L67 96', 'none', st(DK, 4)) +
      P('M50 6L90 46L50 86L10 46z', '#ff9a1f') + P('M50 14L82 46L50 78L18 46z', 'none', sw(2.4)) +
      N(C(41, 31, 4.5, INKc()) + P('M41 37L37 50L44 54L42 64M37 50L32 60M40 42L52 46', 'none', st(INKc(), 4) + ' stroke-linecap="round"') +
        P('M52 46L58 60', 'none', st(INKc(), 3)) + P('M54 60L64 58L62 64z', INKc()) + P('M48 70Q58 56 70 70z', INKc()));
  });
  function INKc() { return h.INK; }
  def('hardhat', 'Hard hat', 'build', 0.12, 'any', 'hop', 'clang', '', function () {
    return R(8, 62, 84, 11, 5.5, Y) + P('M18 64Q18 24 50 24Q82 24 82 64z', Y) +
      P('M43 26Q50 22 57 26V63H43z', YD) + shine(32, 40, 4, 9, 25) + N(R(22, 66, 56, 2.4, 1, '#fff', op(0.45)));
  });

  /* ---------- the building site backdrop ---------- */
  A.back('build', 'Building site', { sky: [0.07, 0.26], ground: [0.62, 0.86],
    pool: ['excavator', 'bulldozer', 'dumptruck', 'mixer', 'loader', 'roller', 'forklift', 'backhoe', 'mobilecrane', 'worker', 'worker2', 'worker3', 'cone', 'barrier', 'dirtpile', 'bricks', 'barrow', 'rocks'] }, function () {
    var s = h.sky() + h.cloud(290, 40, 0.8) + h.cloud(170, 70, 0.6), i;
    [[226, 70, 26], [254, 54, 20], [276, 82, 30], [308, 62, 18], [328, 86, 26], [356, 50, 22], [380, 74, 20]].forEach(function (b) {
      s += R(b[0], b[1], b[2], 150 - b[1], 1, '#b6cdec');
      for (var y = b[1] + 8; y < 136; y += 12) s += R(b[0] + 5, y, b[2] - 10, 4, 1, '#dbe8f8');
    });
    s += P('M0 150Q120 140 220 146Q320 152 400 142V300H0z', '#d39b5f');
    var mesh = '';
    for (i = -40; i < 420; i += 12) mesh += 'M' + i + ' 118l30 40M' + (i + 30) + ' 118l-30 40';
    s += G(P(mesh, 'none', st('#e6e8f4', 1.4)), '', '') + P('M0 118H400', 'none', st('#c9cde3', 3));
    for (i = 6; i < 400; i += 48) s += R(i - 2, 114, 5, 46, 1, '#9aa0bd');
    s += R(0, 156, 400, 144, 0, '#d39b5f');
    s += E(80, 200, 70, 14, '#c58c52') + E(300, 286, 90, 10, '#c58c52');
    // the half-built frame
    var F = '#ff7a45';
    s += R(14, 150, 128, 8, 0, '#a9adc9') + R(14, 108, 128, 6, 0, '#c9cde3');
    [18, 58, 98, 136].forEach(function (x) { s += R(x - 3, 30, 7, 124, 0, F); });
    [34, 70, 108].forEach(function (y) { s += R(14, y, 128, 6, 0, F); });
    s += P('M18 70L58 34M58 70L98 34M98 108L136 70', 'none', st('#ff9a6a', 3));
    s += R(10, 88, 136, 4, 0, '#c98a4a') + P('M12 88V150M144 88V150', 'none', st('#9aa0bd', 2.5)) + R(10, 128, 136, 4, 0, '#c98a4a');
    s += R(70, 144, 30, 10, 1, '#e2583e') + R(74, 136, 22, 8, 1, '#e2583e');
    // dirt piles and the pit
    s += P('M296 176Q318 140 344 150Q364 146 384 178z', '#b8804a') + N(C(330, 160, 3, '#9a6a3e') + C(352, 168, 2.6, '#9a6a3e'));
    s += P('M196 214Q206 194 262 192Q334 190 356 210Q346 244 280 248Q210 248 196 214z', '#8a5a35') +
      P('M210 216Q220 202 264 201Q324 200 340 214Q330 238 278 240Q222 240 210 216z', '#6e4426') +
      P('M222 220Q270 212 330 218', 'none', st('#9a6a3e', 3)) + E(276, 232, 26, 5, '#5a3820');
    s += P('M150 212Q160 194 176 198Q190 194 198 214z', '#b8804a');
    s += P('M20 240q30-10 60 0t60 0M240 262q30-10 60 0t60 0', 'none', st('#b98244', 3) + ' stroke-dasharray="6 6"');
    var r = h.rng(11);
    for (i = 0; i < 18; i++) s += E(f(r() * 400), f(170 + r() * 90), f(2 + r() * 3), f(1.5 + r() * 2), '#a9adc9');
    s += R(0, 266, 400, 6, 0, '#c9cde3') + R(0, 272, 400, 28, 0, '#6f6d86') + P('M6 287H400', 'none', st('#ffd23f', 3.5) + ' stroke-dasharray="18 14"');
    return s;
  });
})(SceneArt);
