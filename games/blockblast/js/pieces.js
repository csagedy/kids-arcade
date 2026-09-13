/* Piece shapes. There is no rotation in this game, so every orientation a
   player might want is listed as its own shape. */

var BB_COLORS = [
  '#e5484d', '#ff8a3d', '#ffd645', '#3fb950',
  '#26c6c6', '#4fa3f7', '#a06cf0', '#f06ca8'
];

var SHAPES = [
  { w: 1.4, art: ['#'] },
  { w: 1.2, art: ['##'] },
  { w: 1.2, art: ['#', '#'] },
  { w: 1.1, art: ['###'] },
  { w: 1.1, art: ['#', '#', '#'] },
  { w: 0.9, art: ['####'] },
  { w: 0.9, art: ['#', '#', '#', '#'] },
  { w: 0.5, art: ['#####'] },
  { w: 0.5, art: ['#', '#', '#', '#', '#'] },
  { w: 1.1, art: ['##', '##'] },
  { w: 0.35, art: ['###', '###', '###'] },

  // small corners
  { w: 1.0, art: ['#.', '##'] },
  { w: 1.0, art: ['##', '#.'] },
  { w: 1.0, art: ['##', '.#'] },
  { w: 1.0, art: ['.#', '##'] },

  // big corners
  { w: 0.7, art: ['#..', '#..', '###'] },
  { w: 0.7, art: ['###', '#..', '#..'] },
  { w: 0.7, art: ['###', '..#', '..#'] },
  { w: 0.7, art: ['..#', '..#', '###'] },

  // tees
  { w: 0.7, art: ['###', '.#.'] },
  { w: 0.7, art: ['.#.', '###'] },
  { w: 0.7, art: ['#.', '##', '#.'] },
  { w: 0.7, art: ['.#', '##', '.#'] },

  // zigzags
  { w: 0.5, art: ['.##', '##.'] },
  { w: 0.5, art: ['##.', '.##'] },
  { w: 0.5, art: ['#.', '##', '.#'] },
  { w: 0.5, art: ['.#', '##', '#.'] }
];

function makePiece(shape, colorIndex) {
  var cells = [];
  var shapeIndex = SHAPES.indexOf(shape);
  for (var r = 0; r < shape.art.length; r++) {
    for (var c = 0; c < shape.art[r].length; c++) {
      if (shape.art[r][c] === '#') cells.push([r, c]);
    }
  }
  return {
    cells: cells,
    rows: shape.art.length,
    cols: shape.art[0].length,
    color: colorIndex,
    shape: shapeIndex   // index into SHAPES, so a tray can be saved and restored
  };
}

/* Weighted pick, so the board isn't constantly handed 3x3 blocks. */
function randomPiece() {
  var total = 0, i;
  for (i = 0; i < SHAPES.length; i++) total += SHAPES[i].w;
  var roll = Math.random() * total;
  for (i = 0; i < SHAPES.length; i++) {
    roll -= SHAPES[i].w;
    if (roll <= 0) return makePiece(SHAPES[i], Math.floor(Math.random() * BB_COLORS.length));
  }
  return makePiece(SHAPES[0], 0);
}
