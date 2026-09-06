/* Median-cut colour quantisation: repeatedly split the colour box with the
   widest channel until we have as many boxes as colours we want, then average
   each box. Plenty good for turning a snapshot into a paint-by-number. */

function quantize(pixels, maxColors) {
  var boxes = [makeBox(pixels.map(function (p, i) { return i; }), pixels)];

  while (boxes.length < maxColors) {
    // Split whichever box is currently the ugliest compromise.
    var target = -1, best = 0;
    for (var i = 0; i < boxes.length; i++) {
      // spread of 0 means the box is one flat colour: splitting it would just
      // hand the player two identical swatches.
      if (boxes[i].indices.length > 1 && boxes[i].spread > best) { best = boxes[i].spread; target = i; }
    }
    if (target < 0) break;

    var box = boxes[target];
    var ch = box.channel;
    var sorted = box.indices.slice().sort(function (a, b) { return pixels[a][ch] - pixels[b][ch]; });
    var mid = sorted.length >> 1;
    boxes.splice(target, 1,
      makeBox(sorted.slice(0, mid), pixels),
      makeBox(sorted.slice(mid), pixels));
  }

  var palette = boxes.map(function (b) { return b.mean; });
  var indices = new Uint8Array(pixels.length);
  boxes.forEach(function (b, bi) {
    for (var i = 0; i < b.indices.length; i++) indices[b.indices[i]] = bi;
  });

  return mergeSimilar(palette, indices, 26);
}

/* Colours too close to tell apart make for a miserable palette, so fold each
   one into the first colour it is near and renumber what's left. */
function mergeSimilar(palette, indices, threshold) {
  var keep = [], map = new Array(palette.length);

  for (var i = 0; i < palette.length; i++) {
    var found = -1;
    for (var k = 0; k < keep.length; k++) {
      var a = palette[i], b = keep[k];
      // Rough perceptual weighting; good enough to catch near-duplicates.
      var d = Math.sqrt(2 * Math.pow(a[0] - b[0], 2) + 4 * Math.pow(a[1] - b[1], 2) + 3 * Math.pow(a[2] - b[2], 2));
      if (d < threshold) { found = k; break; }
    }
    if (found < 0) { map[i] = keep.length; keep.push(palette[i]); }
    else { map[i] = found; }
  }

  var out = new Uint8Array(indices.length);
  for (var j = 0; j < indices.length; j++) out[j] = map[indices[j]];
  return { palette: keep, indices: out };
}

function makeBox(indices, pixels) {
  var min = [255, 255, 255], max = [0, 0, 0], sum = [0, 0, 0];
  for (var i = 0; i < indices.length; i++) {
    var p = pixels[indices[i]];
    for (var c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
      sum[c] += p[c];
    }
  }
  // Weight the ranges roughly by how sensitive the eye is to each channel.
  var ranges = [(max[0] - min[0]) * 1.0, (max[1] - min[1]) * 1.2, (max[2] - min[2]) * 0.8];
  var channel = ranges.indexOf(Math.max.apply(null, ranges));
  var n = Math.max(1, indices.length);

  return {
    indices: indices,
    channel: channel,
    spread: Math.max.apply(null, ranges) * Math.log(n + 1),
    mean: [sum[0] / n, sum[1] / n, sum[2] / n]
  };
}
