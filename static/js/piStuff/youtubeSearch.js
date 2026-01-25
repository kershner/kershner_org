export const YouTubeSearch = (() => {
  let cache = new Map();
  let selectedIndex = -1;

  // Server-side search endpoint - pulled from Django
  const SEARCH_ENDPOINT = window.YOUTUBE_SEARCH_URL;
  
  function isYouTubeUrl(str) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(str);
  }

  async function searchVideos(query) {
    if (cache.has(query)) {
      return cache.get(query);
    }

    try {
      const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        console.error('Search failed:', response.status);
        return '<div class="search-error">Search failed. Please try again.</div>';
      }
      
      const html = await response.text();
      cache.set(query, html);
      return html;
      
    } catch (error) {
      console.error('Search failed:', error);
      return '<div class="search-error">Network error. Please try again.</div>';
    }
  }

  function renderResults(html, container, input) {
    selectedIndex = -1;

    // Wrap results in a styled container
    const hasResults = !html.includes('search-error') && !html.includes('search-no-results');
    const wrappedHtml = hasResults 
      ? `<div class="search-results">${html}</div>`
      : `<div class="search-results">${html}</div>`;
    
    container.innerHTML = wrappedHtml;
    container.classList.remove('hidden');

    // Get all result items from the rendered HTML
    const items = container.querySelectorAll('.search-result-item');
    // const results = Array.from(items);

    if (items.length === 0) {
      return;
    }

    // Add click handlers and index for keyboard navigation
    items.forEach((item, index) => {
      item.dataset.index = index;
      
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        
        if (type === 'video') {
          const videoId = item.dataset.videoId;
          input.value = `https://www.youtube.com/watch?v=${videoId}`;
        } else if (type === 'playlist') {
          const playlistId = item.dataset.playlistId;
          input.value = `https://www.youtube.com/playlist?list=${playlistId}`;
        }
        
        // Trigger change event so form knows the value updated
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function handleKeyNavigation(e, dropdown, input) {
    const items = dropdown.querySelectorAll('.search-result-item');
    
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      const type = item.dataset.type;
      
      if (type === 'video') {
        const videoId = item.dataset.videoId;
        input.value = `https://www.youtube.com/watch?v=${videoId}`;
      } else if (type === 'playlist') {
        const playlistId = item.dataset.playlistId;
        input.value = `https://www.youtube.com/playlist?list=${playlistId}`;
      }
      
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      selectedIndex = -1;
    }
  }

  function updateSelection(items) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  async function performSearch(inputElement, containerElement) {
    const query = inputElement.value.trim();
    
    // If it's a URL, don't search
    if (isYouTubeUrl(query)) {
      return;
    }

    // Require at least 3 characters
    if (query.length < 3) {
      return;
    }

    containerElement.innerHTML = '<div class="search-results"><div class="search-loading">Searching YouTube...</div></div>';
    containerElement.classList.remove('hidden');
    
    const html = await searchVideos(query);
    renderResults(html, containerElement, inputElement);
  }

  function init(inputElement, resultsContainer, searchButton) {
    // Search button click handler
    searchButton.addEventListener('click', () => {
      performSearch(inputElement, resultsContainer);
    });

    // Enter key in input field triggers search
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !resultsContainer.classList.contains('hidden')) {
        // If results are open, handle navigation
        handleKeyNavigation(e, resultsContainer, inputElement);
      } else if (e.key === 'Enter') {
        // If results are closed, perform search
        e.preventDefault();
        performSearch(inputElement, resultsContainer);
      } else if (!resultsContainer.classList.contains('hidden')) {
        // Handle other navigation keys when results are open
        handleKeyNavigation(e, resultsContainer, inputElement);
      }
    });
  }

  return { init };
})();