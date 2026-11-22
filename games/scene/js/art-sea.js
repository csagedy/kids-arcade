/* Scene Maker art: sea life. Real species, each drawn so its tell-tale
   feature reads at thumb size (the hammerhead's hammer, the orca's eye
   patch, the narwhal's tusk, the manta's head fins, the anglerfish's lure),
   plus reef bits, a submarine and a diver. Swimmers face right so Flip
   turns them round. Also the two sea backdrops: under the sea and the
   ocean surface with an island. */
(function (A) {
  'use strict';
  var h = A.h, P = h.P, C = h.C, E = h.E, R = h.R, N = h.N, G = h.G, sw = h.sw, st = h.st, op = h.op, rot = h.rot,
      tube = h.tube, shine = h.shine, eye = h.eye, eyes = h.eyes, eyeW = h.eyeW, smile = h.smile, cheek = h.cheek, cheeks = h.cheeks,
      limb = h.limb, taper = h.taper, f = h.f, INK = h.INK;
  var def = A.def;
  /* a stripe across an ellipse (cx, cy, rx, ry) between xa and xb, sides bowed by k */
  function band(xa, xb, cx, cy, rx, ry, k, fill, x) {
    var ya = ry * Math.sqrt(Math.max(0, 1 - Math.pow((xa - cx) / rx, 2))), yb = ry * Math.sqrt(Math.max(0, 1 - Math.pow((xb - cx) / rx, 2)));
    return P('M' + f(xa) + ' ' + f(cy - ya) + 'Q' + f(xa - k) + ' ' + cy + ' ' + f(xa) + ' ' + f(cy + ya) +
      'L' + f(xb) + ' ' + f(cy + yb) + 'Q' + f(xb - k) + ' ' + cy + ' ' + f(xb) + ' ' + f(cy - yb) + 'z', fill, x);
  }
  function flukes(x, y, c) { return P('M' + (x + 4) + ' ' + y + 'L' + (x - 9) + ' ' + (y - 14) + 'Q' + (x - 2) + ' ' + (y - 8) + ' ' + x + ' ' + (y - 2) + 'Q' + (x - 2) + ' ' + (y + 6) + ' ' + (x - 9) + ' ' + (y + 13) + 'z', c); }

  /* ---------- whales and dolphins ---------- */
  def('bluewhale', 'Blue whale', 'sea', 0.36, 'water', 'swim', 'whale', 'swim', function () {
    var B = '#5b86c7', L = '#a9c3ef';
    return flukes(12, 52, B) +
      P('M12 52Q14 44 30 42Q62 36 84 42Q97 46 97 52Q96 58 84 61Q60 66 32 62Q14 60 12 52z', B) +
      N(P('M58 59Q76 60 92 55M60 62Q75 63 88 59', 'none', st(L, 2)) + C(30, 48, 1.6, L) + C(40, 45, 1.4, L) + C(50, 47, 1.8, L) + C(36, 52, 1.3, L) + C(46, 52, 1.5, L) + C(58, 44, 1.4, L)) +
      P('M27 43L32 37L36 42z', B) + P('M58 59Q56 69 65 71Q64 63 62 59z', B) +
      P('M96 52Q90 55 79 55', 'none', sw(2)) + eye(81, 50, 1.8);
  });
  def('humpback', 'Humpback whale', 'sea', 0.34, 'water', 'swim', 'whale', 'swim', function () {
    var D = '#3e4d78', W = '#e8eef8';
    return flukes(14, 50, D) + N(P('M8 38Q12 44 14 48', 'none', st(W, 2))) +
      P('M12 50Q16 40 34 40Q66 36 84 44Q96 50 95 56Q90 62 78 63Q54 66 32 60Q14 58 12 50z', D) +
      P('M62 60Q78 64 93 57Q86 66 72 66Q62 65 62 60z', W) + P('M66 63Q78 65 88 61', 'none', sw(1.5)) +
      P('M34 41Q38 35 43 40z', D) +
      N(C(84, 45, 1.8, '#7484b8') + C(88, 47, 1.7, '#7484b8') + C(80, 43.5, 1.6, '#7484b8') + C(91, 50, 1.6, '#7484b8') + C(86, 50, 1.4, '#7484b8')) +
      P('M54 58Q48 76 32 90Q46 86 54 79Q62 70 63 60z', W) + N(C(50, 70, 1.4, '#c4cfe6') + C(45, 77, 1.4, '#c4cfe6') + C(40, 83, 1.4, '#c4cfe6')) +
      eye(79, 52, 1.9);
  });
  def('orca', 'Orca', 'sea', 0.3, 'water', 'swim', 'orca', 'swim', function () {
    var K = '#232038', W = '#fff';
    return flukes(12, 54, K) +
      P('M8 54Q10 42 30 40Q60 36 80 44Q94 50 92 56Q88 64 70 64Q40 68 22 62Q10 60 8 54z', K) +
      P('M44 40Q46 24 39 9Q57 25 60 40z', K) +
      N(P('M38 41Q50 36 62 41Q50 45 38 41z', '#8d93b0')) +
      P('M92 56Q85 63 70 63Q56 63 50 59Q64 58 76 55Q86 52 92 56z', W, sw(2)) +
      P('M28 58Q36 51 46 57Q38 62 28 58z', W, sw(2)) +
      E(72, 46, 7, 3.2, W, sw(2) + rot(-12, 72, 46)) +
      P('M60 60Q56 70 64 72Q66 66 64 60z', K) +
      eye(82, 50, 1.8);
  });
  def('dolphin', 'Dolphin', 'sea', 0.28, 'water', 'flap', 'dolphin', 'swim', function () {
    var G = '#7f9ccf', L = '#d5e2f7';
    return flukes(12, 52, G) +
      P('M10 52Q24 36 52 36Q74 36 84 44L97 46Q96 50 86 52Q76 62 52 62Q28 62 10 52z', G) +
      N(P('M30 58Q52 64 82 52Q76 60 54 61Q38 61 30 58z', L)) +
      P('M42 37Q46 25 40 19Q57 27 58 37z', G) + P('M56 58Q52 68 60 70Q62 64 62 58z', G) +
      P('M84 49Q90 52 96 49', 'none', sw(2)) + eye(78, 45, 2) + shine(50, 41, 9, 2, -4);
  });

  /* ---------- sharks and rays ---------- */
  def('shark', 'Great white shark', 'sea', 0.32, 'water', 'swim', 'shark', 'swim', function () {
    var G = '#7d8aa8';
    return P('M14 50L2 27Q9 42 10 50Q9 57 4 70z', G) +
      P('M8 50Q30 34 60 36Q86 38 97 50Q86 60 60 62Q30 62 8 50z', G) +
      P('M97 50Q86 60 60 62Q30 62 11 52Q30 54 42 52L48 55L54 52L62 54L70 51Q84 50 97 50z', '#fff', sw(2)) +
      P('M46 37L54 15L65 37z', G) + P('M58 57L51 74L69 59z', G) + P('M30 57L26 64L36 59z', G) +
      P('M68 45v8M72 45v8M76 45v8', 'none', sw(1.8)) +
      P('M78 56Q87 58 93 53', 'none', sw(2)) + N(P('M81 56.5l1 2.4l1.4-2.4zM85 56.8l1 2.4l1.4-2.6zM89 55.6l1 2.2l1.2-2.6z', '#fff')) +
      eye(85, 46, 2.1);
  });
  def('hammerhead', 'Hammerhead shark', 'sea', 0.3, 'water', 'swim', 'shark', 'swim', function () {
    var G = '#8c93ad', D = '#6c7391';
    // seen from above, so the hammer shows: eyes at the two ends
    return P('M14 50L1 40L5 50L1 60z', G) +
      P('M56 47L42 28L50 28L66 46z', G) + P('M56 53L42 72L50 72L66 54z', G) +
      P('M28 48L22 44L22 56L28 52z', G) +
      P('M10 50Q30 43 62 45L77 46L77 54L62 55Q30 57 10 50z', G) +
      N(P('M34 50Q50 47 66 49', 'none', st(D, 3))) +
      P('M74 28Q84 24 89 32Q93 50 89 68Q84 76 74 72Q70 62 77 56L77 44Q70 38 74 28z', G) +
      N(E(84, 50, 3, 12, D)) +
      eye(84, 30, 2.3) + eye(84, 70, 2.3);
  });
  def('whaleshark', 'Whale shark', 'sea', 0.36, 'water', 'swim', 'whale', 'swim', function () {
    var B = '#4a5f8f', L = '#c9d6f0', s = '';
    var r = h.rng(5);
    for (var i = 0; i < 26; i++) { var x = 22 + r() * 62, y = 40 + r() * 13; s += C(f(x), f(y), f(0.9 + r() * 0.8), '#fff'); }
    return P('M14 50L2 28Q9 42 10 50Q9 57 3 68z', B) +
      P('M8 50Q30 32 64 34Q90 36 97 48Q92 60 64 62Q30 64 8 50z', B) +
      N(P('M14 53Q40 60 64 60Q86 58 95 52Q90 60 64 62Q32 64 14 53z', L)) +
      N(P('M30 40v14M42 37v18M54 36v19M66 36v18M76 38v14', 'none', st('#8fa4d0', 1.4)) + s) +
      P('M44 35L52 22L60 35z', B) + P('M54 58L48 70L64 60z', B) +
      P('M97 48Q94 54 86 55', 'none', sw(2.4)) + eye(86, 45, 1.7);
  });
  def('manta', 'Manta ray', 'sea', 0.32, 'water', 'flap', 'whoosh', 'float', function () {
    var D = '#3d4a7a', W = '#e8eeff';
    return P('M50 72Q53 86 47 98', 'none', sw(2.4)) +
      P('M50 30Q66 28 96 52Q76 52 62 68L50 74L38 68Q24 52 4 52Q34 28 50 30z', D) +
      N(P('M28 44Q38 38 44 48Q36 51 28 44zM72 44Q62 38 56 48Q64 51 72 44z', W)) +
      P('M41 34Q35 22 42 15Q46 24 47 32z', D) + P('M59 34Q65 22 58 15Q54 24 53 32z', D) +
      P('M46 32Q50 35 54 32', 'none', st('#fff', 2)) +
      eye(43, 36, 1.8) + eye(57, 36, 1.8) + N(P('M50 40V62', 'none', st('#5a6aa0', 2.4)));
  });

  /* ---------- the two must-haves ---------- */
  def('turtle', 'Sea turtle', 'sea', 0.24, 'water', 'swim', 'blub', 'swim', function () {
    var K = '#7fcf9a', KD = '#4fae74', SH = '#b8792f', SC = '#e9b062', DK = '#7a4a1f';
    var s = P('M58 34Q70 9 95 11Q85 24 70 41z', K) + P('M58 66Q70 91 95 89Q85 76 70 59z', K) +
      P('M27 38Q14 25 5 29Q11 40 24 45z', K) + P('M27 62Q14 75 5 71Q11 60 24 55z', K) +
      N(C(77, 19, 2, KD) + C(85, 16, 1.6, KD) + C(70, 27, 1.8, KD) + C(77, 81, 2, KD) + C(85, 84, 1.6, KD) + C(70, 73, 1.8, KD) + C(14, 32, 1.5, KD) + C(14, 68, 1.5, KD)) +
      P('M20 50L8 46L8 54z', K) +
      E(78, 50, 9, 7, K) + E(86, 50, 9.5, 8, K) + N(C(84, 50, 1.6, KD) + C(80, 47, 1.3, KD) + C(80, 53, 1.3, KD)) +
      eye(89, 44.5, 1.9) + eye(89, 55.5, 1.9) + P('M94.5 47Q96.5 50 94.5 53', 'none', sw(1.8));
    // shell: rim of marginal scutes, then the central row and the side scutes
    s += E(46, 50, 30, 23, SC);
    var ticks = '';
    for (var i = 0; i < 20; i++) {
      var a = i * Math.PI / 10;
      ticks += 'M' + f(46 + 24 * Math.cos(a)) + ' ' + f(50 + 18 * Math.sin(a)) + 'L' + f(46 + 30 * Math.cos(a)) + ' ' + f(50 + 23 * Math.sin(a));
    }
    s += P(ticks, 'none', sw(1.8)) + E(46, 50, 24, 18, SH);
    s += P('M39 50L38 32.5M53 50L54 32.5M39 50L38 67.5M53 50L54 67.5M25 50H22M67 50H70', 'none', sw(2));
    [32, 46, 60].forEach(function (x) { s += P('M' + (x - 7) + ' 50L' + (x - 4) + ' 43H' + (x + 4) + 'L' + (x + 7) + ' 50L' + (x + 4) + ' 57H' + (x - 4) + 'z', SC, sw(2)); });
    s += N(P('M28 40q3-3 6 0M44 38q3-3 6 0M58 40q3-3 6 0M28 60q3 3 6 0M44 62q3 3 6 0M58 60q3 3 6 0M32 50q-2-2 0-4M46 50q-2-2 0-4M60 50q-2-2 0-4', 'none', st(DK, 1.6)));
    return s + shine(38, 36, 8, 2.4, -12);
  });
  def('octopus', 'Octopus', 'sea', 0.22, 'water', 'wiggle', 'blub', 'bob', function () {
    var O = '#a678ff', OD = '#8455e6', SU = '#efe4ff';
    /* eight fat arms fanned under the head, each curling up at the tip,
       the back four a shade darker; suckers along the under side */
    var back = '', front = '';
    for (var i = 0; i < 8; i++) {
      var a = (172 - i * 164 / 7) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), side = ca < 0 ? 1 : -1;
      var bx = 50 + 12 * ca, by = 54 + 6 * sa;
      var p = [[bx, by], [50 + 24 * ca, 59 + 24 * sa], [50 + 40 * ca, 66 + 30 * sa], [50 + 47 * ca, 56 + 34 * sa]];
      var tp = taper(p, 15, 5);
      var su = '';
      [0.32, 0.52, 0.72, 0.88].forEach(function (t, j) { var q = tp.at(t, 0.5 * side * (sa > 0.9 ? 0 : 1)); su += C(f(q[0]), f(q[1]), f(2.3 - j * 0.35), SU, sw(1.3)); });
      var arm = '<g stroke-width="2.4">' + P(tp.d, i % 2 ? OD : O) + su + '</g>';
      if (i % 2) back += arm; else front += arm;
    }
    return back + front +
      E(50, 36, 25, 25, O) + N(E(50, 52, 20, 6, O)) +
      N(C(40, 22, 2.6, OD) + C(58, 18, 2.2, OD) + C(64, 30, 2.4, OD) + C(48, 14, 1.8, OD)) + shine(39, 22, 6, 3.5, -30) +
      eyes(41, 59, 40, 3.6) + smile(50, 46, 4) + cheeks(34, 66, 46, 3);
  });

  def('squid', 'Squid', 'sea', 0.18, 'water', 'swim', 'blub', 'float', function () {
    var S = '#ff8f7a', D = '#e0654f', s = '';
    s += limb([[44, 62], [36, 78], [28, 86], [24, 93]], 4, 2.6, S) + E(23, 94, 3.6, 4.4, S, rot(30, 23, 94));
    s += limb([[56, 62], [64, 78], [72, 86], [76, 93]], 4, 2.6, S) + E(77, 94, 3.6, 4.4, S, rot(-30, 77, 94));
    for (var i = 0; i < 6; i++) { var x = 41 + i * 3.6, dx = (i - 2.5) * 3.6; s += limb([[x, 62], [x + dx * 0.4, 70], [x + dx * 0.8, 76], [x + dx, 82]], 5, 2.2, i % 2 ? D : S); }
    return s + R(37, 49, 26, 15, 7, S) +
      P('M50 9L25 27L39 33z', S) + P('M50 9L75 27L61 33z', S) +
      P('M50 5Q66 17 64 52H36Q34 17 50 5z', S) +
      N(C(46, 22, 2, D) + C(54, 30, 2.4, D) + C(45, 40, 2, D) + C(56, 44, 1.6, D) + C(50, 14, 1.4, D)) + shine(44, 22, 2.4, 8, 5) +
      eyeW(42, 56, 2.5) + eyeW(58, 56, 2.5);
  });
  def('jelly', 'Jellyfish', 'sea', 0.16, 'water', 'float', 'blub', 'float', function () {
    return P('M30 48q-5 12 2 24q5 10-2 22M41 52q-4 12 2 22q4 10-1 18M59 52q4 12-2 22q-4 10 1 18M70 48q5 12-2 24q-5 10 2 22', 'none', st('#c8a0ff', 2.5)) +
      limb([[44, 50], [39, 62], [48, 70], [43, 86]], 7, 3, '#ff9ed8') + limb([[56, 50], [61, 62], [52, 70], [57, 86]], 7, 3, '#ff9ed8') +
      P('M22 50Q22 14 50 14Q78 14 78 50Q71 55 64 50Q57 56 50 50Q43 56 36 50Q29 55 22 50z', '#d6b8ff') +
      N(P('M30 44Q30 22 50 22Q70 22 70 44z', '#ebe0ff', op(0.7))) + shine(36, 26, 5, 3, -30) +
      eyes(42, 58, 36, 2.6) + smile(50, 40.5, 3.4) + cheeks(36, 64, 42, 2.4);
  });
  def('seahorse', 'Seahorse', 'sea', 0.14, 'water', 'float', 'blub', 'float', function () {
    var Y = '#ffb52e', D = '#e0861a';
    return limb([[48, 72], [46, 89], [30, 92], [33, 79]], 8, 3.6, Y) +
      P('M44 46Q31 52 38 64Q43 57 47 52z', '#ffd76a') +
      limb([[60, 28], [42, 40], [60, 62], [48, 76]], 18, 9, Y) +
      N(P('M51 44h8M53 50h8M54 56h7M52 62h7M49 68h6', 'none', st(D, 2))) +
      P('M54 18L56 8L60 14L63 6L66 14L69 10L68 18z', Y) +
      E(62, 24, 11, 10, Y) +
      P('M70 19L88 21Q92 24 88 28L70 30z', Y) +
      eye(63, 22, 2.6) + cheek(61, 29, 2.4);
  });

  /* ---------- reef fish ---------- */
  def('clownfish', 'Clownfish', 'sea', 0.13, 'water', 'swim', 'blub', 'swim', function () {
    var O = '#ff7a1f';
    return P('M22 50Q8 35 5 40Q10 50 5 60Q8 65 22 50z', O) +
      P('M36 33Q50 18 66 33z', O) + P('M44 67Q52 79 61 67z', O) +
      E(50, 50, 30, 19, O) +
      band(26, 31, 50, 50, 30, 19, 2, '#fff') + band(44, 52, 50, 50, 30, 19, 3, '#fff') + band(64, 70, 50, 50, 30, 19, -3, '#fff') +
      P('M60 56Q66 64 72 58z', O) +
      C(74, 46, 5, '#fff', sw(2)) + eye(75, 46, 2.8) + P('M80 54q-2 2-5 1', 'none', sw(2));
  });
  def('angelfish', 'Angelfish', 'sea', 0.15, 'water', 'swim', 'blub', 'swim', function () {
    var B = '#2a4fb8', Y = '#ffd23f';
    return P('M28 50L10 37Q15 50 10 63z', Y) +
      P('M34 34Q52 4 78 34Q62 28 46 34z', B) + P('M34 66Q52 96 76 66Q62 72 46 66z', B) +
      E(52, 50, 26, 23, B) +
      N(P('M30 41Q52 35 74 41M28 48Q52 42 77 48M28 55Q52 49 77 55M31 62Q52 56 73 62', 'none', st(Y, 2.6))) +
      P('M64 32Q69 50 64 68L71 66Q76 50 71 33z', '#1b1d4a', sw(2)) +
      P('M71 33Q79 42 78 52Q77 62 71 66Q75 50 71 33z', '#cfe6ff', sw(2)) +
      P('M52 52Q58 60 63 55z', Y) + eyeW(68, 44, 1.9);
  });
  def('puffer', 'Pufferfish', 'sea', 0.13, 'water', 'pulse', 'boing', 'bob', function () {
    var Y = '#ffd86b', sp = '';
    for (var i = 0; i < 18; i++) {
      var a = i * Math.PI / 9 + 0.1, b = 0.13;
      sp += 'M' + f(52 + 27 * Math.cos(a - b)) + ' ' + f(50 + 27 * Math.sin(a - b)) + 'L' + f(52 + 38 * Math.cos(a)) + ' ' + f(50 + 38 * Math.sin(a)) + 'L' + f(52 + 27 * Math.cos(a + b)) + ' ' + f(50 + 27 * Math.sin(a + b)) + 'z';
    }
    return P(sp, '#ffb52e', sw(2)) + P('M22 50L8 41L8 59z', Y) + C(52, 50, 30, Y) +
      N(E(52, 64, 22, 13, '#fff8e0') + C(40, 32, 2.4, '#c98a4a') + C(52, 26, 2.2, '#c98a4a') + C(62, 30, 2, '#c98a4a') + C(34, 42, 2, '#c98a4a') + C(46, 38, 1.6, '#c98a4a')) +
      P('M46 52Q39 60 48 62z', '#ffb52e') + eyeW(66, 41, 3) + E(82, 53, 3.2, 3.8, '#ff9e7a') + cheek(70, 54, 3);
  });
  def('angler', 'Anglerfish', 'sea', 0.2, 'water', 'swim', 'blub', 'swim', function () {
    var B = '#6a5a9a';
    return P('M22 54L6 40Q10 54 6 68z', B) + P('M40 26Q46 14 58 21z', B) +
      N(C(84, 20, 11, '#fff6a0', op(0.35))) + P('M52 21Q57 2 75 5Q86 8 84 17', 'none', sw(2.6)) +
      P('M20 54Q18 22 52 20Q80 20 88 42L63 54L88 64Q82 84 52 84Q20 84 20 54z', B) +
      P('M88 42L63 54L88 64z', '#2a1a3a') +
      P('M85 44L83 50L80.5 45.5zM79 47L77 53L74.5 48.5zM73 50L71 55L69 51zM85 63L83 57L80.5 61.5zM79 60.5L77 55L74.5 59.5zM73 58L71 54L69 57.5z', '#fff', sw(1.2)) +
      N(C(36, 40, 1.8, '#9a8ad0') + C(30, 56, 2, '#9a8ad0') + C(42, 70, 1.6, '#9a8ad0') + C(50, 32, 1.4, '#9a8ad0')) +
      P('M44 66Q35 76 48 76z', B) + C(84, 20, 5, '#fff6a0') + eyeW(60, 34, 2.4);
  });

  /* ---------- more sea animals ---------- */
  def('narwhal', 'Narwhal', 'sea', 0.3, 'water', 'swim', 'whale', 'swim', function () {
    var G = '#b9c6e3', D = '#8594bb';
    return flukes(12, 54, G) +
      P('M77 46L99 33L80 50z', '#fff6e0') + P('M84 43.6l1.2 3M88 41.2l1.2 3M92 38.8l1.2 3M96 36.4l1 2.6', 'none', sw(1.5)) +
      P('M8 54Q12 42 30 40Q56 36 70 42Q82 46 82 54Q80 62 64 64Q36 68 22 62Q10 60 8 54z', G) +
      N(C(30, 48, 2, D) + C(40, 44, 1.6, D) + C(48, 50, 2.2, D) + C(24, 54, 1.6, D) + C(56, 45, 1.8, D) + C(36, 56, 1.4, D) + E(48, 60, 18, 3, '#dfe6f5')) +
      P('M56 60Q52 70 60 72Q62 66 62 60z', G) + eye(73, 49, 1.9) + P('M81 56q-4 3-9 2', 'none', sw(1.8)) + cheek(72, 55, 2.4);
  });
  def('seal', 'Seal', 'sea', 0.2, 'water', 'hop', 'seal', 'bob', function () {
    var G = '#a9b2cc', D = '#7f88a8';
    return P('M16 72L4 63L6 81z', G) +
      P('M12 74Q12 58 34 56Q46 54 56 44Q62 30 74 30Q88 30 90 42Q92 52 82 56Q74 74 54 82Q30 88 12 74z', G) +
      N(P('M30 80Q52 80 72 62Q70 74 52 82Q38 86 30 80z', '#d6dcec') + C(30, 64, 2, D) + C(42, 60, 1.6, D) + C(62, 52, 1.8, D) + C(22, 70, 1.4, D) + C(70, 38, 1.4, D)) +
      P('M50 74Q46 88 58 86Q58 80 56 74z', G) +
      eye(77, 39, 3) + E(89, 44, 2.6, 2, INK) + P('M84 48l10 2M84 50l9 5', 'none', sw(1.4)) + P('M87 49q-3 3-6 1', 'none', sw(2)) + cheek(80, 47, 2.6);
  });
  def('otter', 'Sea otter', 'sea', 0.2, 'water', 'wiggle', 'squeak', 'bob', function () {
    var B = '#9a6a45', L = '#e8d2b0';
    return limb([[20, 60], [12, 58], [7, 54], [4, 47]], 9, 5, B) +
      E(22, 47, 5, 8, B, rot(-30, 22, 47)) + E(32, 46, 5, 8, B, rot(-10, 32, 46)) +
      E(48, 60, 32, 15, B) + N(E(50, 57, 22, 8, '#b8875e')) +
      C(72, 38, 3.6, B) + C(88, 38, 3.6, B) +
      C(80, 50, 14, B) + E(82, 53, 10.5, 8.5, L) +
      eyes(76, 87, 47, 2.2) + E(82, 53, 2.6, 2, INK) + P('M79 56q3 2 6 0', 'none', sw(1.8)) + P('M74 54l-8-1M74 56l-8 2M90 54l7-1M90 56l7 2', 'none', sw(1.2)) +
      E(56, 50, 8, 6, '#ff9ec7') + P('M56 44.5V55.5M52 45.5L54 55M60 45.5L58 55', 'none', sw(1.4)) +
      C(49, 51, 3.6, B) + C(63, 51, 3.6, B);
  });
  def('penguin', 'Penguin', 'sea', 0.13, 'ground', 'wiggle', 'squawk', 'bob', function () {
    var K = '#2f2a4a';
    return E(40, 90, 8, 3.6, '#ff9f43') + E(60, 90, 8, 3.6, '#ff9f43') +
      E(25, 58, 6, 16, K, rot(18, 25, 58)) + E(75, 58, 6, 16, K, rot(-18, 75, 58)) +
      E(50, 56, 23, 33, K) + E(50, 63, 16, 24, '#fff') +
      C(42, 34, 9, '#fff', ' stroke="none"') + C(58, 34, 9, '#fff', ' stroke="none"') +
      N(E(33, 38, 4, 6, '#ffb52e', rot(20, 33, 38)) + E(67, 38, 4, 6, '#ffb52e', rot(-20, 67, 38)) + E(50, 48, 9, 3, '#ffe9a6')) +
      eyes(43, 57, 33, 2.6) + P('M45 39L50 45L55 39z', '#ff9f43') + cheeks(38, 62, 41, 2.4);
  });
  def('crab', 'Crab', 'sea', 0.13, 'ground', 'wiggle', 'snip', 'bob', function () {
    var R2 = '#ff5d4d';
    return tube('M30 60L16 56L10 62', R2, 3.5) + tube('M30 66L14 68L10 76', R2, 3.5) + tube('M33 72L22 80L20 88', R2, 3.5) +
      tube('M70 60L84 56L90 62', R2, 3.5) + tube('M70 66L86 68L90 76', R2, 3.5) + tube('M67 72L78 80L80 88', R2, 3.5) +
      tube('M36 52L25 36', R2, 5) + tube('M64 52L75 36', R2, 5) +
      P('M26 38Q12 36 12 24Q14 14 24 16L22 24Q20 26 24 30Q28 30 30 26z', R2) + P('M24 16Q32 10 34 20L28 26z', R2) +
      P('M74 38Q88 36 88 24Q86 14 76 16L78 24Q80 26 76 30Q72 30 70 26z', R2) + P('M76 16Q68 10 66 20L72 26z', R2) +
      P('M43 48V34M57 48V34', 'none', sw(2.6)) + C(43, 31, 5, '#fff') + C(57, 31, 5, '#fff') + eye(43.5, 31.5, 2.6) + eye(57.5, 31.5, 2.6) +
      E(50, 60, 27, 17, R2) + shine(40, 52, 7, 2.6, -15) + smile(50, 62, 5) + cheeks(36, 64, 62, 3);
  });
  def('lobster', 'Lobster', 'sea', 0.16, 'ground', 'wiggle', 'snip', 'bob', function () {
    var L = '#e8453c';
    return P('M46 30Q30 10 18 3M54 30Q70 10 82 3', 'none', sw(2)) +
      tube('M43 48L31 52M43 54L31 60M43 60L33 66M57 48L69 52M57 54L69 60M57 60L67 66', L, 2.6) +
      tube('M44 36L32 30L26 22', L, 5) + tube('M56 36L68 30L74 22', L, 5) +
      E(22, 13, 8, 11, L, rot(-20, 22, 13)) + P('M22 2L24 14', 'none', sw(2)) +
      E(78, 13, 8, 11, L, rot(20, 78, 13)) + P('M78 2L76 14', 'none', sw(2)) +
      P('M50 82L37 95Q50 99 63 95z', L) + P('M50 84V96M44 86L41 95M56 86L59 95', 'none', sw(1.5)) +
      E(50, 79, 7, 3.6, L) + E(50, 73, 8, 4, L) + E(50, 67, 9, 4.5, L) + E(50, 60, 10, 5, L) +
      E(50, 42, 11, 15, L) + shine(46, 36, 2.4, 6, 0) + eye(46, 31, 1.8) + eye(54, 31, 1.8);
  });
  def('starfish', 'Starfish', 'sea', 0.12, 'ground', 'spin', 'chime', 'twinkle', function () {
    var d = N([[50, 22], [50, 34], [30, 44], [70, 44], [26, 76], [74, 76], [38, 64], [62, 64], [50, 76], [40, 52], [60, 52]].map(function (p) { return C(p[0], p[1], 1.8, '#ffc08a'); }).join(''));
    return P(h.starD(50, 54, 44, 20, 5), '#ff8a3d') + d + eyes(43, 57, 52, 2.8) + smile(50, 58, 4) + cheeks(37, 63, 60, 2.6);
  });
  def('urchin', 'Sea urchin', 'sea', 0.1, 'ground', 'pulse', 'boing', '', function () {
    var d = '';
    for (var i = 0; i < 26; i++) { var a = Math.PI + i * Math.PI / 25 - 0.02; d += 'M' + f(50 + 17 * Math.cos(a)) + ' ' + f(62 + 17 * Math.sin(a)) + 'L' + f(50 + 36 * Math.cos(a)) + ' ' + f(62 + 34 * Math.sin(a)); }
    for (var j = 0; j < 5; j++) { var b = Math.PI * (0.2 + j * 0.15); d += 'M' + f(50 + 17 * Math.cos(b)) + ' ' + f(62 + 14 * Math.sin(b)) + 'L' + f(50 + 26 * Math.cos(b)) + ' ' + f(62 + 22 * Math.sin(b)); }
    return P(d, 'none', sw(6)) + P(d, 'none', st('#8a64d6', 2.4)) + E(50, 64, 21, 18, '#6b4fb3') + shine(42, 54, 5, 2.6, -25) + eyes(43, 57, 64, 2.4) + smile(50, 69, 3);
  });

  /* ---------- reef and things ---------- */
  def('coral', 'Coral', 'sea', 0.2, 'ground', 'sway', 'blub', 'sway', function () {
    var K = '#ff7a9a';
    return R(76, 66, 9, 24, 4.5, '#ff9f43') + R(86, 72, 8, 18, 4, '#ffb35c') + N(E(80.5, 67, 2.6, 1.4, '#c86a12') + E(90, 73, 2.4, 1.3, '#c86a12')) +
      limb([[46, 74], [36, 66], [24, 62], [14, 50]], 7, 4, K) + limb([[56, 66], [66, 62], [74, 54], [80, 42]], 7, 4, K) +
      limb([[50, 90], [48, 70], [40, 56], [30, 36]], 11, 5, K) + limb([[50, 90], [54, 66], [64, 50], [70, 24]], 11, 5, K) + limb([[49, 72], [50, 54], [48, 38], [50, 18]], 9, 5, K) +
      N(C(14, 49, 2, '#ffd0dc') + C(30, 35, 2, '#ffd0dc') + C(50, 17, 2, '#ffd0dc') + C(70, 23, 2, '#ffd0dc') + C(80, 41, 2, '#ffd0dc')) +
      E(50, 91, 32, 6, '#8f86b8');
  });
  def('kelp', 'Kelp', 'sea', 0.24, 'ground', 'sway', 'blub', 'sway', function () {
    var G = '#5aa83a', L = '#8cc84a', s = '';
    s += limb([[40, 96], [30, 70], [48, 44], [36, 6]], 5, 3, G) + limb([[58, 96], [68, 72], [52, 46], [64, 12]], 5, 3, G);
    [[34, 78, -40], [44, 58, 40], [40, 32, -40], [62, 80, 40], [56, 58, -40], [60, 30, 40]].forEach(function (b) {
      s += E(b[0] + (b[2] > 0 ? 9 : -9), b[1], 10, 4.6, L, rot(b[2] > 0 ? -25 : 25, b[0] + (b[2] > 0 ? 9 : -9), b[1])) + C(b[0], b[1] + 3, 2.6, '#c9a24a', sw(2));
    });
    return s;
  });
  def('shell', 'Shell', 'sea', 0.1, 'ground', 'wiggle', 'chime', '', function () {
    var d = '';
    for (var i = 0; i < 7; i++) { var a = Math.PI * (1.1 + i * 0.8 / 6); d += 'M50 82L' + f(50 + 36 * Math.cos(a)) + ' ' + f(48 + 36 * Math.sin(a) * 0.95); }
    return P('M40 78H60L57 90H43z', '#ffb3a0') + P('M50 84L15 44Q22 14 50 12Q78 14 85 44z', '#ffc2b0') + P(d, 'none', st('#e8806a', 2.4)) + shine(36, 30, 5, 2.4, -30);
  });
  def('chest', 'Treasure chest', 'sea', 0.18, 'ground', 'pulse', 'tada', 'twinkle', function () {
    var W = '#b9773e', G = '#ffd23f';
    return C(36, 28, 7, G) + C(50, 24, 7, G) + C(64, 28, 7, G) + C(44, 20, 6, G) + C(57, 19, 6, G) + N(C(34, 26, 2, '#fff7c2') + C(48, 22, 2, '#fff7c2')) +
      P('M14 48V40Q14 28 50 28Q86 28 86 40V48z', '#c98a4a') + R(14, 46, 72, 38, 4, W) +
      P('M30 30V84M70 30V84', 'none', st(G, 6)) + P('M30 30V84M70 30V84', 'none', sw(1)) + R(42, 48, 16, 14, 3, G) + N(C(50, 55, 2.4, INK)) +
      P(h.starD(84, 20, 6, 2.4, 4, 0), '#fff', sw(1.6));
  });
  def('submarine', 'Submarine', 'sea', 0.26, 'water', 'swim', 'sonar', 'swim', function () {
    var Y = '#ffd23f';
    return P('M8 52L2 42V62z', '#9aa0bd') + R(8, 47, 6, 10, 1, '#6b6788') +
      P('M58 22V10H67', 'none', st('#3b3350', 4)) +
      R(44, 22, 22, 18, 4, Y) + P('M18 38L14 28L28 38z', '#ff9f43') +
      R(12, 36, 82, 32, 16, Y) + N(R(16, 60, 74, 3, 1.5, '#ff9f43')) +
      C(34, 51, 6, '#bfe9ff') + C(52, 51, 6, '#bfe9ff') + C(70, 51, 6, '#bfe9ff') + shine(32, 49, 1.6, 2.6, 30) + shine(50, 49, 1.6, 2.6, 30) + shine(68, 49, 1.6, 2.6, 30) +
      shine(40, 40, 18, 2, 0);
  });
  def('diver', 'Diver', 'sea', 0.16, 'water', 'float', 'blub', 'float', function () {
    return h.person({ skin: '#f2c29a', hair: '#3b2a20', style: 'short', top: '#2b3a7a', legs: '#2b3a7a', fins: '#ff5d73', tank: '#ffd23f', mask: true }) +
      C(76, 22, 3.2, '#e6f6ff', sw(2)) + C(82, 12, 2.4, '#e6f6ff', sw(2)) + C(78, 4, 1.8, '#e6f6ff', sw(1.6));
  });

  /* ---------- backdrops ---------- */
  var SEA_POOL = ['clownfish', 'angelfish', 'turtle', 'octopus', 'jelly', 'seahorse', 'puffer', 'shark', 'manta', 'dolphin', 'starfish', 'crab', 'coral', 'kelp', 'chest', 'submarine', 'diver', 'squid', 'hammerhead', 'whaleshark', 'urchin', 'lobster', 'angler'];
  A.back('sea', 'Under the sea', { sky: [0.12, 0.5], ground: [0.84, 0.92], water: [0.12, 0.72, 0.06, 0.94], pool: SEA_POOL }, function () {
    var s = R(0, 0, 400, 300, 0, 'url(#sm-sea)'), i;
    s += P('M0 0H400V10Q380 18 360 10T320 10T280 10T240 10T200 10T160 10T120 10T80 10T40 10T0 10z', '#c6f6ff', op(0.45));
    s += G(P('M60 0H112L64 262H6z', 'url(#sm-ray)') + P('M176 0H208L196 240H148z', 'url(#sm-ray)') + P('M290 0H346L392 252H318z', 'url(#sm-ray)'), '', 'b-ray');
    s += P('M0 206Q40 176 80 194Q120 166 170 190Q230 172 280 194Q330 174 400 188V300H0z', '#17549f', op(0.55));
    var fish = '';
    [[250, 90], [266, 84], [262, 100], [280, 92], [244, 104], [276, 106], [292, 98]].forEach(function (p) { fish += E(p[0], p[1], 5, 2.4, '#2a6fc0') + P('M' + (p[0] - 5) + ' ' + p[1] + 'l-4-3v6z', '#2a6fc0'); });
    s += G(fish, '', 'b-drift');
    s += P('M0 246Q100 228 200 242Q300 258 400 236V300H0z', '#f2d595') +
      P('M20 262q20-6 40 0t40 0M150 272q20-6 40 0t40 0M280 268q20-6 40 0t40 0M60 286q20-6 40 0t40 0M230 290q20-6 40 0t40 0', 'none', st('#e2bf78', 2.4));
    s += E(70, 252, 36, 18, '#7d74b0') + E(108, 262, 20, 11, '#9088c2') + E(352, 248, 28, 14, '#7d74b0') + E(60, 244, 14, 6, '#9a92cc');
    // kelp forest on the left
    var kelp = '';
    [[24, 250, 34], [44, 256, 56], [62, 248, 90], [12, 262, 110]].forEach(function (k) {
      kelp += h.limb([[k[0], k[1]], [k[0] - 14, k[1] - 70], [k[0] + 16, k[1] - 130], [k[0] - 4, k[2]]], 6, 3, '#4f9e34');
      for (var y = k[1] - 30; y > k[2] + 10; y -= 34) kelp += E(k[0] + 8, y, 9, 4, '#7cc04a', rot(-25, k[0] + 8, y)) + E(k[0] - 7, y - 16, 9, 4, '#7cc04a', rot(25, k[0] - 7, y - 16));
    });
    s += G(kelp, '', 'b-sway');
    // the reef on the right
    s += E(300, 244, 26, 17, '#ff9f43') + P('M280 240q6-6 12 0t12 0t12 0M282 250q6-6 12 0t12 0t12 0', 'none', st('#d9781c', 2.4));
    var fan = 'M250 250L232 196M250 250L250 186M250 250L270 194M250 250L240 214L224 210M250 250L262 210L280 212M244 226L258 222M238 206L262 202';
    s += P(fan, 'none', st('#a77bff', 4) + ' stroke-linecap="round"') + P('M226 204Q250 176 276 200', 'none', st('#c9a8ff', 3));
    s += h.limb([[352, 244], [350, 220], [338, 206], [330, 186]], 8, 4, '#ff7a9a') + h.limb([[354, 244], [360, 220], [372, 208], [378, 184]], 8, 4, '#ff7a9a') + h.limb([[352, 230], [354, 214], [352, 198], [354, 180]], 7, 4, '#ff7a9a');
    s += R(374, 214, 9, 34, 4.5, '#b48cff') + R(386, 222, 8, 26, 4, '#c9a8ff') + E(378.5, 215, 3, 1.6, '#7a55c9') + E(390, 223, 2.6, 1.4, '#7a55c9');
    var an = '';
    for (i = 0; i < 9; i++) an += h.limb([[196 + i * 3, 252], [190 + i * 4, 240], [194 + i * 3.4, 232], [186 + i * 5, 222]], 3, 2, '#ff9ed8');
    s += G(an, '', 'b-sway') + E(208, 254, 14, 5, '#ff7ac6');
    s += N(P(h.starD(150, 262, 9, 4, 5), '#ff8a3d') + C(120, 280, 3, '#fff3e0') + C(330, 280, 3, '#ffc2b0'));
    var bub = '';
    [[330, 170, 4], [336, 140, 3], [326, 112, 5], [100, 160, 3], [94, 130, 4], [180, 120, 2.6]].forEach(function (b) { bub += C(b[0], b[1], b[2], 'none', st('#e6faff', 2)); });
    return s + G(bub, '', 'b-rise');
  });

  A.back('ocean', 'Ocean and island', { sky: [0.07, 0.3], ground: [0.46, 0.52], water: [0.62, 0.88, 0.05, 0.7], pool: ['boat', 'humpback', 'bluewhale', 'orca', 'dolphin', 'narwhal', 'seal', 'otter', 'penguin', 'submarine', 'sun', 'cloud', 'bird', 'shark'] }, function () {
    var s = h.sky('sm-warm') + N(C(84, 76, 34, '#fff3b0', op(0.4))) + C(84, 76, 22, '#fff3b0') + h.cloud(170, 48, 0.8) + h.cloud(300, 30, 0.6);
    s += P('M128 54q6-6 12 0q6-6 12 0M160 40q5-5 10 0q5-5 10 0', 'none', st('#4a4a6a', 2.4) + ' stroke-linecap="round" stroke-linejoin="round"');
    s += R(0, 150, 400, 150, 0, 'url(#sm-ocean)');
    s += N(P('M60 160h44M72 170h26M54 180h52M78 192h18', 'none', st('#fff6c8', 3) + op(0.6) + ' stroke-linecap="round"'));
    // the island
    s += P('M228 162Q268 140 322 142Q380 142 400 150V176Q330 170 228 172z', '#f7d99a') +
      P('M268 150Q298 108 338 120Q368 116 392 150Q340 146 268 150z', '#4fb35e') +
      P('M300 148Q296 112 312 84', 'none', st('#a0714f', 6) + ' stroke-linecap="round"') +
      h.limb([[312, 84], [298, 76], [286, 80], [278, 92]], 7, 2, '#3ddc84') + h.limb([[312, 84], [326, 74], [340, 78], [346, 90]], 7, 2, '#3ddc84') +
      h.limb([[312, 84], [304, 68], [292, 64], [282, 66]], 6, 2, '#2fbf71') + h.limb([[312, 84], [322, 66], [334, 62], [342, 66]], 6, 2, '#2fbf71') +
      C(309, 88, 3.4, '#8a5a35') + C(315, 89, 3.4, '#8a5a35') +
      E(244, 172, 10, 5, '#a9adc9') + E(390, 176, 12, 6, '#a9adc9');
    var w = '';
    for (var y = 190; y < 300; y += 22) {
      var d = 'M' + (-((y * 3) % 40)) + ' ' + y;
      for (var x = 0; x < 440; x += 40) d += 'q10-7 20 0t20 0';
      w += P(d, 'none', st('#bfe9ff', 2.6) + op(0.5));
    }
    s += G(w, '', 'b-ripple');
    return s + P('M0 284q25-10 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0V300H0z', '#4cc2ff', op(0.6));
  });
})(SceneArt);
