/* One finger paints, two fingers pinch and pan. Dropping a second finger
   cancels the stroke in progress so a zoom never smears colour across the grid. */

function bindInput(stage, renderer, onPaintCell) {
  var pointers = {};
  var painting = false;
  var last = null;
  var pinch = null;

  function pos(e) {
    var r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function count() { return Object.keys(pointers).length; }

  /* Walk the line between two samples so a fast swipe doesn't skip cells. */
  function strokeTo(pt) {
    if (!last) { last = pt; return; }
    var dx = pt.x - last.x, dy = pt.y - last.y;
    var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (renderer.view.s * 0.4)));
    for (var i = 1; i <= steps; i++) {
      var idx = renderer.cellAt(last.x + dx * i / steps, last.y + dy * i / steps);
      if (idx >= 0) onPaintCell(idx);
    }
    last = pt;
  }

  stage.addEventListener('pointerdown', function (e) {
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    pointers[e.pointerId] = pos(e);

    if (count() === 1) {
      painting = true;
      last = pointers[e.pointerId];
      var idx = renderer.cellAt(last.x, last.y);
      if (idx >= 0) onPaintCell(idx);
    } else if (count() === 2) {
      painting = false;
      last = null;
      pinch = startPinch();
    }
    e.preventDefault();
  });

  stage.addEventListener('pointermove', function (e) {
    if (!(e.pointerId in pointers)) return;
    pointers[e.pointerId] = pos(e);

    if (painting && count() === 1) {
      strokeTo(pointers[e.pointerId]);
    } else if (count() === 2 && pinch) {
      var now = startPinch();
      var v = renderer.view;
      var k = now.dist / pinch.dist;
      // Zoom about the midpoint between the fingers, then follow their drift.
      v.s *= k;
      v.tx = now.mid.x - (pinch.mid.x - v.tx) * k;
      v.ty = now.mid.y - (pinch.mid.y - v.ty) * k;
      renderer.clamp();
      pinch = now;
    }
    e.preventDefault();
  });

  function release(e) {
    delete pointers[e.pointerId];
    if (count() < 2) pinch = null;
    if (count() === 0) { painting = false; last = null; }
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  function startPinch() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    };
  }

  /* Desktop convenience so this is testable without a phone. */
  stage.addEventListener('wheel', function (e) {
    var v = renderer.view, p = pos(e);
    var k = Math.exp(-e.deltaY * 0.002);
    v.s *= k;
    v.tx = p.x - (p.x - v.tx) * k;
    v.ty = p.y - (p.y - v.ty) * k;
    renderer.clamp();
    e.preventDefault();
  }, { passive: false });

  /* Safari still tries to zoom the page on a double tap inside the canvas. */
  stage.addEventListener('dblclick', function (e) { e.preventDefault(); });
  stage.addEventListener('gesturestart', function (e) { e.preventDefault(); });
}
