/**
 * Search utilities for filtering and displaying events
 */

// Normalize text by removing dashes, underscores and spaces
export const normalize = (text) => text?.toLowerCase().replace(/[-_\s]/g, '') || '';

// Debounce function for search optimization
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Filter events based on search query
export const filterEvents = (events, query) => {
  if (!query || !events?.length) return events;

  const normalizedQuery = normalize(query);

  return events.filter(event => {
    // Try exact matches first (for better performance)
    if (event.title?.toLowerCase().includes(query) ||
      event.org?.title?.toLowerCase().includes(query) ||
      event.venue?.toLowerCase().includes(query)) {
      return true;
    }

    // Try normalized matches for more flexible searching
    if (normalize(event.title).includes(normalizedQuery)) return true;
    if (normalize(event.org?.title).includes(normalizedQuery)) return true;
    if (normalize(event.venue).includes(normalizedQuery)) return true;
    if (normalize(event.description).includes(normalizedQuery)) return true;

    // Enhanced tag search - check individual tags and concatenated tags
    if (event.tags?.length) {
      // Check individual tags
      if (event.tags.some(tag => normalize(tag).includes(normalizedQuery))) {
        return true;
      }

      // Create concatenated versions of tags for more flexible matching
      const normalizedTags = event.tags.map(tag => normalize(tag));
      const concatenatedTags = normalizedTags.join('');

      // Check if the query is within the concatenated tags
      if (concatenatedTags.includes(normalizedQuery)) {
        return true;
      }

      // Try different permutations for multi-word searches
      if (normalizedQuery.length > 5) {
        for (let i = 3; i < normalizedQuery.length - 2; i++) {
          const firstPart = normalizedQuery.substring(0, i);
          const secondPart = normalizedQuery.substring(i);

          if (normalizedTags.some(tag => tag.includes(firstPart)) &&
            normalizedTags.some(tag => tag.includes(secondPart))) {
            return true;
          }
        }
      }
    }

    return false;
  });
};

// Animation helpers
export const animateElement = (element, show) => {
  if (show) {
    element.classList.remove('hide');
    // Delay adding loaded class to trigger animation
    setTimeout(() => {
      element.classList.add('loaded');
    }, 10);
  } else {
    element.classList.remove('loaded');
    // Wait for animation to complete before hiding
    setTimeout(() => {
      element.classList.add('hide');
    }, 300);
  }
};

// Animate number changing
export const animateNumber = (element, start, end, duration) => {
  const range = end - start;
  const startTime = performance.now();

  function updateNumber(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smoother animation
    const easeOutQuad = t => t * (2 - t);
    const easedProgress = easeOutQuad(progress);

    const currentValue = Math.floor(start + range * easedProgress);
    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }

  requestAnimationFrame(updateNumber);
};
