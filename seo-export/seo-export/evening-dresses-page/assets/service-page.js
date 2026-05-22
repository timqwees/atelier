(function () {
  function initSlider(slider) {
    var viewport = slider.querySelector('[data-service-slider-viewport]');
    if (!viewport) return;

    slider.querySelectorAll('[data-service-slider-button]').forEach(function (button) {
      button.addEventListener('click', function () {
        var direction = button.getAttribute('data-service-slider-button') === 'next' ? 1 : -1;
        var firstCard = viewport.querySelector('.service-slider__card');
        var step = firstCard ? firstCard.getBoundingClientRect().width + 24 : viewport.clientWidth * 0.8;

        viewport.scrollBy({
          left: step * direction,
          behavior: 'smooth',
        });
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-service-slider]').forEach(initSlider);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
