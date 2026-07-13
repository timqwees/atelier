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

  function initStickyCta() {
    var sticky = document.querySelector('.service-sticky-cta');
    if (!sticky) return;

    var closeButton = sticky.querySelector('.service-sticky-cta__close');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        sticky.classList.remove('visible');
        // Сохраняем состояние в localStorage
        localStorage.setItem('sticky-cta-closed', 'true');
      });
    }

    // Проверяем, не был ли закрыт ранее
    if (localStorage.getItem('sticky-cta-closed') === 'true') {
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          sticky.classList.remove('visible');
        } else {
          sticky.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    var target = document.querySelector('#pricing');
    if (target) {
      observer.observe(target);
    }
  }

  function initHeroAssistant() {
    var root = document.querySelector('[data-brand-reference-dresses-assistant]');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    var API_URL = '/api/chat';
    var MAX_PHOTOS = 4;
    var MAX_DIM = 1024;
    var JPEG_Q = 0.8;

    var messagesEl = root.querySelector('[data-brand-reference-dresses-assistant-messages]');
    var form = root.querySelector('[data-brand-reference-dresses-assistant-form]');
    var input = root.querySelector('[data-brand-reference-dresses-assistant-input]');
    var fileInput = root.querySelector('[data-brand-reference-dresses-assistant-file]');
    var photoButton = root.querySelector('[data-brand-reference-dresses-assistant-photo]');
    var sendButton = root.querySelector('[data-brand-reference-dresses-assistant-send]');
    var previewsEl = root.querySelector('[data-brand-reference-dresses-assistant-previews]');
    var conversation = [];
    var assistantContext = { route: window.location.pathname, lockBase: true };
    var photos = [];
    var sending = false;
    var sessionStorageKey = 'service-assistant:' + window.location.pathname;
    var sessionId = window.sessionStorage.getItem(sessionStorageKey);
    if (!sessionId) {
      sessionId = 'service-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      window.sessionStorage.setItem(sessionStorageKey, sessionId);
    }

    function scrollDown() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function compressImage(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var width = img.width;
            var height = img.height;
            if (width > MAX_DIM || height > MAX_DIM) {
              var ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas unavailable'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', JPEG_Q));
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function addMessage(role, text, images) {
      var message = document.createElement('div');
      message.className = 'service-hero-assistant__message service-hero-assistant__message--' + role;

      (images || []).forEach(function (src) {
        var image = document.createElement('img');
        image.src = src;
        image.alt = 'Фото для расчета';
        message.appendChild(image);
      });

      if (text) {
        var span = document.createElement('span');
        span.textContent = text;
        message.appendChild(span);
      }

      messagesEl.appendChild(message);
      scrollDown();
      return message;
    }

    function showTyping() {
      var typing = document.createElement('div');
      typing.className = 'service-hero-assistant__typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(typing);
      scrollDown();
      return typing;
    }

    function clearPhotos() {
      photos = [];
      previewsEl.innerHTML = '';
      previewsEl.hidden = true;
      fileInput.value = '';
    }

    function renderPreviews() {
      previewsEl.innerHTML = '';
      if (!photos.length) {
        previewsEl.hidden = true;
        return;
      }

      previewsEl.hidden = false;
      photos.forEach(function (src, index) {
        var preview = document.createElement('div');
        preview.className = 'service-hero-assistant__preview';

        var image = document.createElement('img');
        image.src = src;
        image.alt = 'Превью фото';
        preview.appendChild(image);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Удалить фото');
        remove.textContent = '×';
        remove.addEventListener('click', function () {
          photos.splice(index, 1);
          renderPreviews();
        });
        preview.appendChild(remove);

        previewsEl.appendChild(preview);
      });
    }

    function setSending(value) {
      sending = value;
      sendButton.disabled = value;
      photoButton.disabled = value;
      input.disabled = value;
    }

    function addChatwootFallback() {
      var fb = document.querySelector('.chatwoot-fallback-btn');
      if (fb) return;
      var wrap = document.querySelector('.chat-messages');
      if (!wrap) return;
      var btn = document.createElement('button');
      btn.className = 'chatwoot-fallback-btn';
      btn.textContent = 'Задать вопрос оператору';
      btn.onclick = function () {
        if (window.$chatwoot && window.$chatwoot.toggle) { window.$chatwoot.toggle(); }
        else if (window.chatwootSDK) {
          window.chatwootSDK.run({ websiteToken: 'ZFDyf4j1nG7yALnV2ECbPG5H', baseUrl: 'https://app.chatwoot.com' });
          setTimeout(function () { if (window.$chatwoot && window.$chatwoot.toggle) window.$chatwoot.toggle(); }, 500);
        } else {
          window.open('https://t.me/atelie1513_bot', '_blank');
        }
      };
      wrap.appendChild(btn);
    }

    function send() {
      var text = input.value.trim();
      if ((!text && !photos.length) || sending) return;

      var userImages = photos.slice();
      var userText = text || 'Фото для оценки: платье по референсу бренда';
      addMessage('user', userText, userImages);
      conversation.push({
        role: 'user',
        content: userText,
        images: userImages.length ? userImages : undefined,
      });

      input.value = '';
      clearPhotos();
      setSending(true);
      var typing = showTyping();

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          assistantContext: assistantContext,
          messages: conversation,
        }),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          typing.remove();
          if (data.error) {
            var errMsg = 'Не удалось получить ответ.';
            if (data.chatwootFallback) { errMsg += ' Попробуйте задать этот же вопрос живому оператору в чате.'; addMessage('bot', errMsg); addChatwootFallback(); return; }
            addMessage('bot', data.error);
            return;
          }
          var reply = data.reply || 'Не удалось получить ответ. Попробуйте описать изделие чуть подробнее.';
          conversation.push({ role: 'assistant', content: reply });
          addMessage('bot', reply);
        })
        .catch(function () {
          typing.remove();
          addMessage('bot', 'Не удалось связаться с сервером. Попробуйте ещё раз.');
          addChatwootFallback();
        })
        .finally(function () {
          setSending(false);
          input.focus();
        });
    }

    photoButton.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      var chain = Promise.resolve();

      files.forEach(function (file) {
        chain = chain.then(function () {
          if (photos.length >= MAX_PHOTOS || !file.type || !file.type.match(/^image\//)) return null;
          return compressImage(file).then(function (src) {
            photos.push(src);
          });
        });
      });

      chain
        .then(renderPreviews)
        .catch(function () {
          addMessage('bot', 'Не получилось обработать фото. Попробуйте другой файл.');
        })
        .finally(function () {
          fileInput.value = '';
        });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      send();
    });

    scrollDown();
  }

  function init() {
    document.querySelectorAll('[data-service-slider]').forEach(initSlider);
    initStickyCta();
    initHeroAssistant();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
