(function() {
  var overlay = document.createElement("div");
  overlay.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);align-items:center;justify-content:center;cursor:pointer";
  var img = document.createElement("img");
  img.style.cssText = "max-width:92vw;max-height:92vh;object-fit:contain;border-radius:8px;cursor:default";
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function() { overlay.style.display = "none"; });
  img.addEventListener("click", function(e) { e.stopPropagation(); });
  var touchY = null;
  overlay.addEventListener("touchstart", function(e) { touchY = e.touches[0].clientY; });
  overlay.addEventListener("touchend", function(e) {
    if (touchY !== null) {
      if (Math.abs(e.changedTouches[0].clientY - touchY) > 60) overlay.style.display = "none";
      touchY = null;
    }
  });
  document.addEventListener("click", function(e) {
    var t = e.target;
    if (t.tagName === "IMG" && t.getAttribute("data-testid") && t.getAttribute("data-testid").indexOf("chat-image-") === 0) {
      img.src = t.src;
      overlay.style.display = "flex";
    }
  });
  document.head.insertAdjacentHTML("beforeend", "<style>[data-testid^=chat-image-]{cursor:pointer;transition:opacity .2s}[data-testid^=chat-image-]:hover{opacity:.8}</style>");
})();
