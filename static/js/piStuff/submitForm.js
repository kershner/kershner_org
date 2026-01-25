import { YouTubeSearch } from './youtubeSearch.js';

export const SubmitForm = (() => {
  function init() {
    const form = document.getElementById('f');
    if (!form) {
      console.error('Submit form not found');
      return;
    }
    
    const submitBtn = form.querySelector('.submit-button');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-button');
    const resultsContainer = document.getElementById('search-results-container');

    // Initialize YouTube search
    if (searchInput && resultsContainer && searchBtn) {
      YouTubeSearch.init(searchInput, resultsContainer, searchBtn);
    }

    function showMessage(text, type = 'success', duration = 3000) {
      const messageEl = document.getElementById('display-message');
      if (!messageEl) return;

      // Set message content and type
      messageEl.textContent = text;
      messageEl.className = 'display-message'; // Reset classes
      messageEl.classList.add('show', type);

      // Hide message after duration
      setTimeout(() => {
        messageEl.classList.remove('show');
      }, duration);
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      
      submitBtn.disabled = true;
      
      try {
        const data = new URLSearchParams(new FormData(e.target));
        const r = await fetch(window.API_PLAY_URL, { method: 'POST', body: data });
        const json = await r.json();
        
        if (r.ok) {
          showMessage('✓ Video sent successfully!', 'success');
          form.reset();
          // Restore hidden fields after reset
          form.querySelector('[name="token"]').value = window.SUBMIT_TOKEN || '';
          form.querySelector('[name="device_id"]').value = window.SUBMIT_DEVICE_ID || '';
        } else {
          // Handle specific error types
          const errorMessages = {
            'invalid_or_expired': 'This QR code is invalid or expired. Please scan a new one.',
            'not_youtube': 'Please provide a valid YouTube URL.',
            'missing_token': 'Invalid request. Please scan the QR code again.',
            'missing_device': 'Invalid request. Please scan the QR code again.'
          };
          
          const message = errorMessages[json.error] || json.message || 'An error occurred. Please try again.';
          showMessage(message, 'error');
        }
      } catch (err) {
        console.error('Submit error:', err);
        showMessage('Network error. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  SubmitForm.init();
});