(function () {
  'use strict';

  /* ===== Config ===== */
  var API_URL = '/api/chat';
  var MAX_PHOTOS = 5;
  var MAX_DIM = 1024;
  var JPEG_Q = 0.8;
  var RESTART_DELAY = 4000;

  /* ===== SVG Icons ===== */
  var ICO_SEND = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>';
  var ICO_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
  var ICO_REPLAY = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 1 9 9"/><polyline points="3 21 3 12 12 12"/></svg>';
  var ICO_MIC = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';

  /* ===== Demo Scenarios ===== */
  var SCENARIO_TEXT = [
    { role: 'user', text: 'хочу пошить платье', delay: 1200 },
    { role: 'bot',  text: 'Подскажите, это платье для особых мероприятий или для повседневной носки?', delay: 2200 },
    { role: 'user', text: 'повседневное', delay: 1500 },
    { role: 'bot',  text: 'Какой фасон — прямое, приталенное (футляр) или с отрезной талией?\n\nС рукавами или без?', delay: 2800 },
    { role: 'user', text: 'футляр с рукавами', delay: 1500 },
    { role: 'bot',  text: 'Из какого материала хотите платье — хлопок, шёлк, шифон? Или что-то другое?\n\nКакой длины — до колена, ниже колена или длинное (в пол)?', delay: 3000 },
    { role: 'user', text: 'шелк с замшевыми вставками. Длинна в пол', delay: 2000 },
    { role: 'bot',  text: 'Подскажите, пожалуйста:\n1. Нужна ли подкладка?\n2. Какой у вас размер одежды?', delay: 2500 },
    { role: 'user', text: 'подкладка нужна, размер 46', delay: 1500 },
    { role: 'bot',  text: 'Ориентировочная стоимость пошива: от 76 250 руб.\n\nПредлагаю записаться в наше ателье для уточнения деталей.\nБудем рады помочь!', delay: 3000 }
  ];

  var SCENARIO_PHOTO = [
    { role: 'bot', text: 'Здравствуйте! Я — AI-консультант Ателье 15/13. Задайте вопрос о пошиве, тканях или ценах, или отправьте фото для расчёта.', delay: 1800 },
    { role: 'user', delay: 1400, images: ['/images/shearling-demo-chat.png'] },
    { role: 'bot', text: 'Подскажите ваш размер одежды', delay: 1800 },
    { role: 'user', text: '54', delay: 1200 },
    { role: 'bot', text: 'Дубленка из овчины с меховым отложным воротником, прямой конструкцией и симметричной молнией, дополненная двумя прорезными карманами и отделкой резинкой на манжетах и низе. Ориентировочная стоимость пошива: от 91 300 руб. Предлагаю записаться в ателье для уточнения деталей.', delay: 3000 }
  ];

  /* ===== Helpers ===== */
  function el(tag, cls, attrs) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
      });
    }
    return node;
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            var ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', JPEG_Q));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ===== Build full section ===== */
  function buildSection() {
    var section = el('section', 'demo-section');
    section.id = 'demo-try';

    var container = el('div', 'demo-container');

    /* Header */
    var header = el('div', 'demo-header');
    header.appendChild(el('span', 'demo-tag', { text: 'Попробуйте прямо сейчас' }));
    var h2 = el('h2');
    h2.innerHTML = 'Ваш <em>персональный</em> консультант';
    header.appendChild(h2);
    header.appendChild(el('p', 'demo-subtitle', {
      text: 'Задайте вопрос о пошиве, отправьте фото — и получите расчёт стоимости за секунды'
    }));

    /* Grid */
    var grid = el('div', 'demo-grid');

    /* Left column — live chat */
    var liveChat = buildLiveChat();

    /* Right column — two demo windows */
    var demoCol = el('div', 'demo-windows-col');
    var demoCard1 = buildDemoCard('Текстовый диалог');
    var demoCard2 = buildDemoCard('Ателье 15/13', { live: true });
    demoCol.appendChild(demoCard1);
    demoCol.appendChild(demoCard2);

    grid.appendChild(liveChat);
    grid.appendChild(demoCol);
    container.appendChild(header);
    container.appendChild(grid);
    section.appendChild(container);

    return { section: section, liveChat: liveChat, demoCard1: demoCard1, demoCard2: demoCard2 };
  }

  /* ===== Live Chat Card (left) ===== */
  function buildLiveChat() {
    var card = el('div', 'demo-chat-card');

    /* Header */
    var hdr = el('div', 'chat-header');
    hdr.appendChild(el('div', 'chat-avatar', { text: 'А' }));
    hdr.appendChild(el('div', 'chat-title', { text: 'Ателье 15/13' }));
    hdr.appendChild(el('span', 'chat-label', { text: 'ЖИВОЙ ЧАТ' }));
    card.appendChild(hdr);

    /* Messages */
    var msgs = el('div', 'demo-messages');
    var greeting = el('div', 'demo-msg demo-msg-bot demo-msg-instant', {
      text: 'Здравствуйте! Я — AI-консультант Ателье 15/13. Задайте вопрос о пошиве, тканях или ценах, или отправьте фото для расчёта.'
    });
    msgs.appendChild(greeting);
    card.appendChild(msgs);

    /* Photo previews (hidden initially) */
    var previews = el('div', 'live-chat-previews');
    previews.style.display = 'none';
    card.appendChild(previews);

    /* Input area */
    var inputArea = el('div', 'live-chat-input-area');
    var fileInput = el('input', 'live-chat-file-input', { type: 'file', accept: 'image/*', multiple: '' });
    var photoBtn = el('button', 'live-chat-btn', { type: 'button', html: ICO_PHOTO, title: 'Прикрепить фото' });
    var textInput = el('input', null, { type: 'text', placeholder: 'Напишите сообщение\u2026' });
    var sendBtn = el('button', 'live-chat-btn live-chat-send-btn', { type: 'button', html: ICO_SEND, title: 'Отправить' });
    var micBtn = el('button', 'live-chat-btn live-chat-mic-btn', { type: 'button', html: ICO_MIC, title: 'Голосовое сообщение' });

    inputArea.appendChild(photoBtn);
    inputArea.appendChild(textInput);
    inputArea.appendChild(micBtn);
    inputArea.appendChild(sendBtn);
    card.appendChild(inputArea);
    card.appendChild(fileInput);

    /* Store refs */
    card._msgs = msgs;
    card._input = textInput;
    card._sendBtn = sendBtn;
    card._micBtn = micBtn;
    card._photoBtn = photoBtn;
    card._fileInput = fileInput;
    card._previews = previews;

    return card;
  }

  /* ===== Live Chat Logic ===== */
  function initLiveChat(card) {
    var msgs = card._msgs;
    var input = card._input;
    var sendBtn = card._sendBtn;
    var photoBtn = card._photoBtn;
    var fileInput = card._fileInput;
    var previewsRow = card._previews;

    var conversation = [];
    var photos = [];
    var sending = false;

    function scrollDown() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function addMsg(role, text, images) {
      var div = el('div', 'demo-msg demo-msg-' + role);
      if (images && images.length) {
        images.forEach(function (src) {
          var img = el('img', role === 'user' ? 'demo-msg-user-img' : 'demo-msg-photo', { src: src, alt: 'Фото' });
          div.appendChild(img);
        });
      }
      if (text) {
        var span = document.createElement('span');
        span.textContent = text;
        div.appendChild(span);
      }
      msgs.appendChild(div);
      scrollDown();
      return div;
    }

    function showTyping() {
      var t = el('div', 'demo-typing');
      t.innerHTML = '<span></span><span></span><span></span>';
      msgs.appendChild(t);
      scrollDown();
      return t;
    }

    function clearPhotos() {
      photos = [];
      previewsRow.innerHTML = '';
      previewsRow.style.display = 'none';
      fileInput.value = '';
    }

    function renderPreviews() {
      previewsRow.innerHTML = '';
      if (!photos.length) {
        previewsRow.style.display = 'none';
        return;
      }
      previewsRow.style.display = 'flex';
      photos.forEach(function (src, i) {
        var thumb = el('div', 'preview-thumb');
        thumb.appendChild(el('img', null, { src: src, alt: 'Превью' }));
        var rm = el('button', 'remove-thumb', { type: 'button', text: '\u2715' });
        rm.addEventListener('click', function () {
          photos.splice(i, 1);
          renderPreviews();
        });
        thumb.appendChild(rm);
        previewsRow.appendChild(thumb);
      });
    }

    /* === Voice recording === */
    var micButton = card._micBtn;
    var voiceRecording = false;
    var voiceRecorder = null;
    var voiceChunks = [];
    var voiceCancelled = false;
    var voiceStartX = 0;

    function startRecording(startX) {
      voiceCancelled = false;
      voiceStartX = startX;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        voiceChunks = [];
        var mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        voiceRecorder = new MediaRecorder(stream, { mimeType: mime });
        voiceRecorder.ondataavailable = function (e) { if (e.data.size > 0) voiceChunks.push(e.data); };
        voiceRecorder.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          voiceRecording = false;
          micButton.style.color = '';
          if (voiceCancelled) return;
          var blob = new Blob(voiceChunks, { type: mime });
          var reader = new FileReader();
          reader.onloadend = function () {
            var base64 = reader.result.split(',')[1];
            fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, mimeType: mime })
            })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (data.text) {
                  input.value = data.text;
                  send();
                }
              })
              .catch(function (err) { console.error('[Voice]', err); });
          };
          reader.readAsDataURL(blob);
        };
        voiceRecorder.start();
        voiceRecording = true;
        micButton.style.color = '#ef4444';
      }).catch(function (err) { console.error('[Voice] Mic denied', err); });
    }

    function stopRecording() { if (voiceRecording && voiceRecorder) voiceRecorder.stop(); }
    function cancelRecording() { voiceCancelled = true; stopRecording(); }

    micButton.addEventListener('mousedown', function (e) { e.preventDefault(); startRecording(e.clientX); });
    document.addEventListener('mousemove', function (e) { if (voiceRecording && e.clientX < voiceStartX - 60) cancelRecording(); });
    document.addEventListener('mouseup', function () { if (voiceRecording) stopRecording(); });
    micButton.addEventListener('touchstart', function (e) { e.preventDefault(); startRecording(e.touches[0].clientX); });
    document.addEventListener('touchmove', function (e) { if (voiceRecording && e.touches[0].clientX < voiceStartX - 60) cancelRecording(); });
    document.addEventListener('touchend', function () { if (voiceRecording) stopRecording(); });

    function send() {
      var text = input.value.trim();
      if ((!text && !photos.length) || sending) return;
      sending = true;
      sendBtn.disabled = true;

      var userImages = photos.slice();
      var userText = text;

      addMsg('user', userText, userImages);
      input.value = '';
      clearPhotos();

      var msg = { role: 'user', content: userText || 'Фото для оценки' };
      if (userImages.length) msg.images = userImages;
      conversation.push(msg);

      var typing = showTyping();

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          typing.remove();
          if (data.error) {
            addMsg('bot', 'Извините, произошла ошибка. Попробуйте ещё раз.');
          } else {
            var reply = data.reply || '';
            conversation.push({ role: 'assistant', content: reply });
            addMsg('bot', reply);
          }
        })
        .catch(function () {
          typing.remove();
          addMsg('bot', 'Не удалось связаться с сервером. Попробуйте позже.');
        })
        .finally(function () {
          sending = false;
          sendBtn.disabled = false;
          input.focus();
        });
    }

    photoBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      var files = Array.from(fileInput.files || []);
      var chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          if (photos.length >= MAX_PHOTOS) return;
          return compressImage(f).then(function (b64) {
            photos.push(b64);
          }).catch(function () { /* skip bad file */ });
        });
      });
      chain.then(function () {
        fileInput.value = '';
        renderPreviews();
      });
    });

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  /* ===== Demo Card (right) ===== */
  function buildDemoCard(titleText, options) {
    options = options || {};
    var card = el('div', 'demo-chat-card');

    var hdr = el('div', 'chat-header');
    hdr.appendChild(el('div', 'chat-avatar', { text: 'А' }));
    hdr.appendChild(el('div', 'chat-title', { text: titleText }));

    var badge = options.live
      ? el('span', 'chat-label', { text: 'ЖИВОЙ ЧАТ' })
      : el('div', 'demo-badge');
    if (!options.live) {
      badge.innerHTML = '<span class="pulse-dot"></span> АВТО';
    }
    hdr.appendChild(badge);

    card.appendChild(hdr);

    var msgs = el('div', 'demo-messages');
    card.appendChild(msgs);

    card._msgs = msgs;
    card._badge = badge;
    card._hdr = hdr;
    card._liveDemo = !!options.live;

    return card;
  }

  /* ===== Demo Playback Engine ===== */
  function initDemo(card, scenario) {
    var msgsEl = card._msgs;
    var badge = card._badge;
    var hdr = card._hdr;
    var timeouts = [];
    var running = false;
    var restartBtn = null;

    function clearAll() {
      timeouts.forEach(clearTimeout);
      timeouts = [];
      msgsEl.innerHTML = '';
      running = false;
    }

    function showRestartBtn() {
      if (restartBtn) return;
      restartBtn = el('button', 'demo-restart-btn', { type: 'button' });
      restartBtn.innerHTML = ICO_REPLAY + ' Заново';
      restartBtn.addEventListener('click', function () {
        play();
      });
      hdr.appendChild(restartBtn);
    }

    function hideRestartBtn() {
      if (restartBtn) {
        restartBtn.remove();
        restartBtn = null;
      }
    }

    function play() {
      clearAll();
      hideRestartBtn();
      running = true;
      if (card._liveDemo) {
        badge.textContent = 'ЖИВОЙ ЧАТ';
      } else {
        badge.innerHTML = '<span class="pulse-dot"></span> АВТО';
      }

      var cumDelay = 500;

      scenario.forEach(function (step, i) {
        if (step.role === 'bot') {
          /* Show typing, then replace with message */
          var typingDelay = cumDelay;
          var msgDelay = cumDelay + 1200;

          timeouts.push(setTimeout(function () {
            var typing = el('div', 'demo-typing');
            typing.innerHTML = '<span></span><span></span><span></span>';
            typing.setAttribute('data-idx', i);
            msgsEl.appendChild(typing);
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }, typingDelay));

          timeouts.push(setTimeout(function () {
            var t = msgsEl.querySelector('[data-idx="' + i + '"]');
            if (t) t.remove();
            var div = el('div', 'demo-msg demo-msg-bot');
            div.textContent = step.text;
            msgsEl.appendChild(div);
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }, msgDelay));

          cumDelay = msgDelay + step.delay;
        } else {
          /* User message */
          timeouts.push(setTimeout(function () {
            var div = el('div', 'demo-msg demo-msg-user');
            if (step.image) {
              div.appendChild(el('img', 'demo-msg-user-img', { src: step.image, alt: 'Фото' }));
            }
            if (step.images) {
              step.images.forEach(function (src) {
                div.appendChild(el('img', 'demo-msg-user-img', { src: src, alt: 'Фото' }));
              });
            }
            if (step.text) {
              var span = document.createElement('span');
              span.textContent = step.text;
              div.appendChild(span);
            }
            msgsEl.appendChild(div);
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }, cumDelay));

          cumDelay += step.delay;
        }
      });

      /* Auto-restart */
      timeouts.push(setTimeout(function () {
        running = false;
        showRestartBtn();
        timeouts.push(setTimeout(function () {
          if (!running) play();
        }, RESTART_DELAY));
      }, cumDelay));
    }

    return { play: play };
  }

  /* ===== Main Init ===== */
  function init() {
    function mount() {
      if (document.getElementById('demo-try')) return true;

      var consultantPage = document.getElementById('consultant-page-mount');
      var hero = document.getElementById('hero');
      if (!consultantPage && !hero) return false;

      var built = buildSection();
      var section = built.section;
      if (consultantPage) {
        consultantPage.appendChild(section);
      } else {
        hero.parentNode.insertBefore(section, hero.nextSibling);
      }

      initLiveChat(built.liveChat);
      var demo1 = initDemo(built.demoCard1, SCENARIO_TEXT);
      var demo2 = initDemo(built.demoCard2, SCENARIO_PHOTO);

      /* Fade-in + start demos on scroll */
      var demosStarted = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            section.classList.add('demo-visible');
            if (!demosStarted) {
              demosStarted = true;
              demo1.play();
              demo2.play();
            }
          }
        });
      }, { threshold: 0.05 });
      io.observe(section);

      return true;
    }

    /* Try immediately (hero may already be rendered) */
    if (mount()) return;

    /* Otherwise wait for React render */
    var obs = new MutationObserver(function () {
      if (mount()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
