/* Doodle Pad button pictures: small inline SVGs (48 x 48), drawn for this
   game so a child who can't read can tell the tools apart. Parts with
   class "ink" take the chosen colour (CSS var --dp-ink), "paper" the
   chosen paper (--dp-paper). */
var DrawArt = (function () {
  'use strict';
  function svg(body, cls) {
    return '<svg class="dp-art' + (cls ? ' ' + cls : '') + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  var A = {};

  A.marker = svg('<g transform="rotate(40 24 24)">' +
    '<path d="M21 8.5 22.4 3.2Q24 1.8 25.6 3.2L27 8.5z" class="ink"/>' +
    '<path d="M18.2 16.5 20.4 8h7.2l2.2 8.5z" fill="#dfe2f5"/>' +
    '<rect x="16" y="15.5" width="16" height="28" rx="5" fill="#fff"/>' +
    '<rect x="16" y="22" width="16" height="5" class="ink"/>' +
    '<rect x="16" y="34" width="16" height="9.5" rx="4.5" class="ink"/>' +
    '<rect x="18.5" y="28.5" width="3" height="4" rx="1.5" fill="#c9cde6"/></g>');

  A.crayon = svg('<g transform="rotate(40 24 24)">' +
    '<path d="M17.5 14 24 1.8 30.5 14z" class="ink"/>' +
    '<path d="M21.8 6 24 1.8 26.2 6z" fill="#000" opacity=".28"/>' +
    '<rect x="17" y="13" width="14" height="32" rx="2.5" class="ink"/>' +
    '<rect x="17" y="18" width="14" height="21" fill="#000" opacity=".24"/>' +
    '<path d="M17 22h14M17 35h14" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>' +
    '<rect x="19.2" y="14.5" width="3" height="29" rx="1.5" fill="#fff" opacity=".35"/></g>');

  A.paint = svg('<g transform="rotate(40 24 24)">' +
    '<rect x="21.6" y="22" width="4.8" height="25" rx="2.4" fill="#c98a4b"/>' +
    '<rect x="22.6" y="24" width="1.4" height="20" rx=".7" fill="#fff" opacity=".35"/>' +
    '<rect x="19.2" y="15.5" width="9.6" height="8.5" rx="1.6" fill="#cfd3e6"/>' +
    '<path d="M19.2 16.3C17.6 10.5 20.8 5.6 24 .8c3.2 4.8 6.4 9.7 4.8 15.5z" class="ink"/>' +
    '<path d="M23 4.4c-1 4-1.1 7.6-.6 11" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>');

  A.rainbow = svg('<g fill="none" stroke-width="4.4" stroke-linecap="round">' +
    '<path d="M5 35a19 19 0 0 1 38 0" stroke="#ff5d73"/>' +
    '<path d="M9.6 35a14.4 14.4 0 0 1 28.8 0" stroke="#ffd23f"/>' +
    '<path d="M14.2 35a9.8 9.8 0 0 1 19.6 0" stroke="#3ddc84"/>' +
    '<path d="M18.8 35a5.2 5.2 0 0 1 10.4 0" stroke="#4cc2ff"/></g>' +
    '<g fill="#fff"><circle cx="7" cy="38" r="4.2"/><circle cx="12" cy="38.6" r="3.4"/><circle cx="41" cy="38" r="4.2"/><circle cx="36" cy="38.6" r="3.4"/></g>');

  A.glitter = svg('<path d="M20 5Q21.6 18 33 20Q21.6 22 20 35Q18.4 22 7 20Q18.4 18 20 5z" class="ink"/>' +
    '<path d="M35.5 25Q36.3 31.5 42 32.5Q36.3 33.5 35.5 40Q34.7 33.5 29 32.5Q34.7 31.5 35.5 25z" fill="#ffd23f"/>' +
    '<circle cx="36.5" cy="10" r="2.8" fill="#fff"/><circle cx="9.5" cy="38" r="2.2" fill="#fff"/>' +
    '<circle cx="24" cy="42.5" r="1.7" fill="#ffd23f"/><circle cx="42" cy="18" r="1.5" fill="#fff"/>');

  A.fill = svg('<g transform="rotate(-24 22 27)">' +
    '<path d="M10.5 16.5a11 9.5 0 0 1 22 0" fill="none" stroke="#8d93c2" stroke-width="2.4"/>' +
    '<path d="M9.5 17h24l-3 23.5a3.2 3.2 0 0 1-3.2 2.8H15.7a3.2 3.2 0 0 1-3.2-2.8z" fill="#dfe2f5"/>' +
    '<path d="M12 22h19" stroke="#fff" stroke-width="2" opacity=".8"/>' +
    '<ellipse cx="21.5" cy="17" rx="12" ry="3.6" class="ink"/></g>' +
    '<path d="M33.6 15.2c4.8 3.2 7.6 9.4 6.4 16-.5 3.2-2 5.4-3.6 6.2-1.6-1.4-2.2-3.6-1.9-6.4.4-3.7.3-8.6-.9-15.8z" class="ink"/>' +
    '<circle cx="37" cy="43" r="2.6" class="ink"/>');

  A.eraser = svg('<g transform="rotate(-35 24 25)">' +
    '<rect x="7" y="16" width="34" height="17" rx="4.5" fill="#ff9ec9"/>' +
    '<rect x="7" y="16" width="14" height="17" rx="4.5" fill="#4cc2ff"/>' +
    '<rect x="17" y="16" width="4" height="17" fill="#4cc2ff"/>' +
    '<rect x="7" y="28" width="34" height="5" rx="2.5" fill="#000" opacity=".16"/>' +
    '<rect x="24" y="19" width="13" height="2.6" rx="1.3" fill="#fff" opacity=".55"/></g>' +
    '<g fill="#fff" opacity=".55"><circle cx="34" cy="41" r="1.6"/><circle cx="39.5" cy="38" r="1.2"/><circle cx="29" cy="43" r="1.1"/></g>');

  /* magic mirror: off (one wing, faint), mirror (a butterfly), kaleidoscope (a flower of 8) */
  var wing = '<path d="M24 23C17 9 6.5 8.5 6 17c-.4 6.2 7 9 18 7z"/><path d="M24 25.5c-8.5 1.5-13.5 7-11.2 12 2.2 4.6 8.6 1 11.2-12z"/>';
  A.mirror0 = svg('<path d="M24 4v40" stroke="#aeb2e0" stroke-width="2.2" stroke-dasharray="3.5 3.5" stroke-linecap="round"/>' +
    '<g fill="#aeb2e0" opacity=".9">' + wing + '</g>');
  A.mirror1 = svg('<path d="M24 4v40" stroke="#fff" stroke-width="2.2" stroke-dasharray="3.5 3.5" stroke-linecap="round" opacity=".8"/>' +
    '<g fill="#ff7ac6">' + wing + '</g><g fill="#a77bff" transform="matrix(-1 0 0 1 48 0)">' + wing + '</g>' +
    '<g fill="#ffd23f"><circle cx="13" cy="17" r="2.4"/><circle cx="35" cy="17" r="2.4"/></g>' +
    '<rect x="22.4" y="14" width="3.2" height="22" rx="1.6" fill="#2a1d5c"/>');
  (function () {
    var cols = ['#ff5d73', '#ff9f43', '#ffd23f', '#3ddc84', '#2ee6c9', '#4cc2ff', '#a77bff', '#ff7ac6'], petals = '';
    for (var i = 0; i < 8; i++) {
      petals += '<ellipse cx="24" cy="12.5" rx="4.6" ry="9" fill="' + cols[i] + '" transform="rotate(' + (i * 45) + ' 24 24)"/>';
    }
    A.mirror2 = svg(petals + '<circle cx="24" cy="24" r="5.4" fill="#fff"/><circle cx="24" cy="24" r="2.6" fill="#ffd23f"/>');
  })();

  A.paper = svg('<rect x="13" y="7" width="26" height="33" rx="4" fill="#9aa0d6" transform="rotate(10 26 23)"/>' +
    '<rect x="9" y="9" width="26" height="33" rx="4" class="paper" stroke="#fff" stroke-width="2.4"/>' +
    '<path d="M14 33q4-6 8-1t8-3" fill="none" stroke="#ff5d73" stroke-width="2.6" stroke-linecap="round"/>');

  A.newpage = svg('<path d="M11 5h17.5L38 14.5V40a3.5 3.5 0 0 1-3.5 3.5h-23A3.5 3.5 0 0 1 8 40V8.5A3.5 3.5 0 0 1 11 5z" fill="#fff"/>' +
    '<path d="M28.5 5v9.5H38z" fill="#d3d6ee"/>' +
    '<circle cx="34" cy="36" r="10" fill="#3ddc84"/><circle cx="34" cy="36" r="10" fill="none" stroke="#1f9a57" stroke-width="2"/>' +
    '<path d="M34 30.5v11M28.5 36h11" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>');

  A.clear = svg('<rect x="21" y="5" width="6" height="5" rx="2" fill="#ff9aa8"/>' +
    '<rect x="8.5" y="9" width="31" height="5.6" rx="2.8" fill="#ff9aa8"/>' +
    '<path d="M11.5 16.5h25l-2.2 23.4a3.4 3.4 0 0 1-3.4 3.1H17.1a3.4 3.4 0 0 1-3.4-3.1z" fill="#ff5d73"/>' +
    '<path d="M19 22v15M24 22v15M29 22v15" stroke="#fff" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>');

  A.gallery = svg('<rect x="4" y="8" width="40" height="32" rx="5" fill="#fff"/>' +
    '<rect x="8" y="12" width="32" height="24" rx="2.5" fill="#7fd0ff"/>' +
    '<path d="M8 36l10-12 7.5 8.5 5-5.5L40 36z" fill="#3ddc84"/>' +
    '<circle cx="31.5" cy="18.5" r="3.8" fill="#ffd23f"/>', 'k-icon dp-art--bar');

  return A;
})();
