(function () {
  let recording = false;
  let mediaRecorder = null;
  let chunks = [];

  function createMicButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-testid', 'button-chat-mic');
    btn.className =
      'inline-flex items-center justify-center rounded-md text-sm font-medium h-10 w-10 hover:bg-accent hover:text-accent-foreground transition-colors';
    btn.title = 'Голосовое сообщение';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
    btn.addEventListener('click', toggle);
    return btn;
  }

  function inject() {
    if (document.querySelector('[data-testid="button-chat-mic"]')) return;
    const attach = document.querySelector('[data-testid="button-chat-attach"]');
    if (!attach) return;
    attach.after(createMicButton());
  }

  async function toggle() {
    const btn = document.querySelector('[data-testid="button-chat-mic"]');
    if (recording) { mediaRecorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recording = false;
        if (btn) btn.style.color = '';
        await transcribeAndSend(new Blob(chunks, { type: mimeType }), mimeType);
      };
      mediaRecorder.start();
      recording = true;
      if (btn) btn.style.color = '#ef4444';
    } catch (err) { console.error('[Voice] Mic access denied', err); }
  }

  async function transcribeAndSend(blob, mimeType) {
    const base64 = await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result.split(',')[1]);
      r.readAsDataURL(blob);
    });
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      });
      const data = await res.json();
      if (data.text) {
        const input = document.querySelector('[data-testid="input-chat-message"]');
        if (!input) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, data.text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-testid="button-chat-send"]');
          if (sendBtn) sendBtn.click();
        }, 150);
      }
    } catch (err) { console.error('[Voice] Transcription failed', err); }
  }

  const observer = new MutationObserver(inject);
  observer.observe(document.body, { childList: true, subtree: true });
})();
