/* Mini Golf courses: three themed courses of six holes. Each course brings
   in one new thing per hole.

   A hole is drawn in its own logical space (about 100 x 160, tee at the
   bottom, cup at the top); the screen fits it, turning it on its side on a
   wide screen. Fields:
     id, name, tip, par, w, h, tee [x, y], cup [x, y]
     floor     polygon (or list of polygons) of green; rails run round it
     blocks    solid polygons (rails round them)       walls   open rail lines
     posts     [x, y, r] solid round posts            bumpers [x, y, r] bouncy
     sand / water / bridges   polygons (a bridge keeps the ball dry)
     hills     [x, y, r, a]  a > 0 a mound, a < 0 a bowl
     slopes    { poly, a: [ax, ay] }   belts { poly, v: [vx, vy] }
     tunnels   { from, to, dir }       spinners { x, y, len, arms, speed }
     gates     { a, b, move: [dx, dy], period, phase }
   Coordinates are only ever literal numbers or built with GolfSim helpers
   (which use the deterministic sine), so the geometry is bit-identical in
   every browser and in Node. */
(function (root) {
  'use strict';
  var S = typeof module !== 'undefined' && module.exports ? require('./sim.js') : root.GolfSim;
  var arc = S.arc, rect = S.rect, rrect = S.rrect, blob = S.blob;

  var COURSES = [
    {
      id: 'candy', name: 'Candy Garden', emoji: '🍭', c1: '#ff7ac6', c2: '#ffb35c',
      holes: [
        { id: 'c1', name: 'Gumdrop Lane', tip: 'Pull back, let go, roll it in!', par: 2, w: 100, h: 160,
          floor: rrect(25, 12, 75, 148, 14), tee: [50, 132], cup: [50, 32] },

        { id: 'c2', name: 'Lollipop Bend', tip: 'Bounce off the wall to go round the corner.', par: 2, w: 100, h: 160,
          floor: [[12, 148], [46, 148], [46, 58], [88, 58], [88, 12]].concat(arc(26, 26, 14, 270, 180)),
          tee: [29, 134], cup: [72, 35] },

        { id: 'c3', name: 'Candy Cane Bank', tip: 'Hit the slanted wall and it sends you over.', par: 2, w: 100, h: 160,
          floor: [[15, 150], [85, 150], [85, 46], [62, 12], [15, 12]],
          blocks: [rrect(15.5, 78, 62, 87, 4)],
          tee: [36, 134], cup: [32, 32] },

        { id: 'c4', name: 'Gumdrop Bumpers', tip: 'Gumdrops are bouncy. Boing!', par: 3, w: 100, h: 160,
          floor: [[10, 150], [90, 150]].concat(arc(50, 52, 40, 360, 180)),
          bumpers: [[50, 80, 5.5], [29, 102, 5], [71, 102, 5], [28, 58, 5], [72, 58, 5]],
          tee: [50, 138], cup: [50, 30] },

        { id: 'c5', name: 'Swirly Loop', tip: 'Roll round the loop. Curvy walls bend the ball.', par: 3, w: 100, h: 160,
          floor: [[12, 150], [88, 150]].concat(arc(50, 62, 38, 360, 180)),
          blocks: [[[44, 149.5]].concat(arc(50, 66, 6, 180, 360), [[56, 149.5]])],
          tee: [72, 136], cup: [28, 128] },

        { id: 'c6', name: 'Sugar Sand', tip: 'Sugar sand slows the ball right down.', par: 3, w: 100, h: 160,
          floor: rrect(14, 10, 86, 150, 16),
          sand: [blob(50, 86, 22, 10, 0.14, 18, 3), blob(34, 44, 10, 8, 0.18, 14, 5), blob(68, 50, 10, 7, 0.18, 14, 7)],
          posts: [[26, 112, 3.5], [74, 112, 3.5]],
          tee: [50, 136], cup: [52, 30] }
      ]
    },
    {
      id: 'pirate', name: 'Pirate Cove', emoji: '🏴‍☠️', c1: '#2ee6c9', c2: '#4c7dff',
      holes: [
        { id: 'p1', name: 'Shipwreck Shallows', tip: 'Splash! Water sends you back. Go round it.', par: 2, w: 100, h: 160,
          floor: rrect(14, 10, 86, 150, 14),
          water: [blob(36, 82, 19, 22, 0.1, 20, 2)],
          tee: [52, 136], cup: [42, 30] },

        { id: 'p2', name: 'Plank Bridge', tip: 'Cross the river on the bridge.', par: 3, w: 100, h: 160,
          floor: rrect(12, 10, 88, 150, 12),
          water: [[[12, 64], [30, 62], [50, 65], [70, 62], [88, 64], [88, 92], [70, 94], [50, 91], [30, 94], [12, 92]]],
          bridges: [rect(40, 60, 60, 96)],
          walls: [[[40, 64], [40, 92]], [[60, 64], [60, 92]]],
          tee: [30, 138], cup: [70, 28] },

        { id: 'p3', name: 'Treasure Hill', tip: 'Hills push the ball down their sides.', par: 3, w: 100, h: 160,
          floor: rrect(12, 10, 88, 150, 18),
          hills: [[50, 82, 27, 150]],
          posts: [[24, 46, 4], [76, 46, 4]],
          tee: [50, 138], cup: [50, 26] },

        { id: 'p4', name: 'Slippery Slope', tip: 'The deck tilts. Aim up the slope!', par: 3, w: 100, h: 160,
          floor: rrect(10, 10, 90, 150, 14),
          slopes: [{ poly: rect(10, 58, 90, 104), a: [-80, 0] }],
          posts: [[30, 30, 4]],
          tee: [50, 138], cup: [70, 28] },

        { id: 'p5', name: 'Gangplank Gate', tip: 'The plank slides. Wait for a gap!', par: 3, w: 100, h: 160,
          floor: rrect(15, 10, 85, 150, 14),
          gates: [{ a: [40, 56], b: [60, 56], move: [15, 0], period: 4 }],
          posts: [[30, 100, 4], [70, 100, 4]],
          tee: [50, 136], cup: [50, 28] },

        { id: 'p6', name: 'Ship Wheel', tip: 'The wheel spins. Sneak between the spokes!', par: 3, w: 100, h: 160,
          floor: [[12, 150], [88, 150], [88, 108], [66, 108], [66, 100], [86, 100], [86, 46], [66, 46], [66, 38], [88, 38],
                  [88, 10], [12, 10], [12, 38], [34, 38], [34, 46], [14, 46], [14, 100], [34, 100], [34, 108], [12, 108]],
          spinners: [{ x: 42, y: 73, len: 16, arms: 3, speed: 1.0 }],
          tee: [50, 138], cup: [50, 24] }
      ]
    },
    {
      id: 'space', name: 'Space Station', emoji: '🚀', c1: '#a77bff', c2: '#4c7dff',
      holes: [
        { id: 's1', name: 'Warp Tunnel', tip: 'Roll into the warp hole to zoom across space.', par: 2, w: 100, h: 160,
          floor: [rrect(14, 96, 86, 150, 12), rrect(14, 10, 86, 64, 12)],
          tunnels: [{ from: [68, 112], to: [24, 38], dir: [1, 0] }],
          tee: [30, 136], cup: [66, 38] },

        { id: 's2', name: 'Moving Walkway', tip: 'The belt carries the ball sideways.', par: 3, w: 100, h: 160,
          floor: rrect(12, 10, 88, 150, 12),
          belts: [{ poly: rect(12, 70, 88, 92), v: [75, 0] }],
          tee: [70, 138], cup: [28, 28] },

        { id: 's3', name: 'Crater Bowl', tip: 'Craters catch the ball. The cup is in a bowl too!', par: 3, w: 100, h: 160,
          floor: rrect(10, 10, 90, 150, 30),
          hills: [[32, 94, 14, -150], [68, 72, 14, -150], [50, 30, 16, -90]],
          posts: [[50, 72, 5]],
          tee: [50, 138], cup: [50, 30] },

        { id: 's4', name: 'Satellite Spinner', tip: 'Dodge the spinning satellite.', par: 3, w: 100, h: 160,
          floor: rrect(10, 10, 90, 150, 14),
          spinners: [{ x: 50, y: 80, len: 18, arms: 2, speed: -1.1 }],
          bumpers: [[24, 46, 5], [76, 46, 5], [24, 116, 4.5], [76, 116, 4.5]],
          tee: [50, 138], cup: [50, 26] },

        { id: 's5', name: 'Airlock Doors', tip: 'Two sliding doors. Time it right!', par: 3, w: 100, h: 160,
          floor: rrect(14, 10, 86, 150, 12),
          gates: [{ a: [40, 100], b: [60, 100], move: [14, 0], period: 2.6 },
                  { a: [40, 56], b: [60, 56], move: [14, 0], period: 3.4, phase: 3.14159 }],
          tee: [50, 138], cup: [50, 28] },

        { id: 's6', name: 'Galaxy Finale', tip: 'Ride the belt up. Missed? The warp brings you back.', par: 3, w: 100, h: 160,
          floor: rrect(10, 10, 90, 150, 14),
          blocks: [[[44, 149.5]].concat(arc(50, 62, 6, 180, 360), [[56, 149.5]])],
          belts: [{ poly: rect(10, 62, 44, 148), v: [0, -80] }],
          slopes: [{ poly: rect(56, 64, 90, 124), a: [0, 70] }],
          tunnels: [{ from: [73, 137], to: [22, 30], dir: [1, 0], r: 6 }],
          bumpers: [[50, 32, 4.5]],
          hills: [[74, 30, 14, -90], [73, 137, 17, -170]],
          tee: [27, 138], cup: [74, 30] }
      ]
    }
  ];

  COURSES.forEach(function (c) { c.holes.forEach(function (h, i) { h.course = c.id; h.n = i + 1; }); });
  var Holes = { COURSES: COURSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = Holes;
  else root.GolfHoles = Holes;
})(this);
