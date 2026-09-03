import { useEffect, useRef } from 'react';

/**
 * useSwipeTabs Hook
 * Enables horizontal swipe gestures to navigate through tabs on mobile devices
 * Mimics Twitter/X style tab navigation
 * 
 * @param {Array} tabs - Array of tab objects with 'id' property
 * @param {string} activeTab - Currently active tab ID
 * @param {function} setActiveTab - Function to update active tab
 * @param {HTMLElement} containerRef - Reference to the container element
 * @returns {object} Touch event handlers
 */
export const useSwipeTabs = (tabs, activeTab, setActiveTab, containerRef) => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const isSwiping = useRef(false);

  // Minimum distance to consider a gesture as a swipe (in pixels)
  const SWIPE_THRESHOLD = 50;
  // Minimum vertical distance to avoid horizontal scrolling interference
  const VERTICAL_THRESHOLD = 30;

  const handleTouchStart = (e) => {
    // Only detect swipe for touch devices (not mouse)
    if (e.touches && e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isSwiping.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchEndX.current = e.touches[0].clientX;
      touchEndY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;

    // Calculate distances
    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = Math.abs(touchStartY.current - touchEndY.current);

    // Prevent swipe if vertical scroll was intended
    if (distanceY > VERTICAL_THRESHOLD) {
      return;
    }

    // Only process if swipe distance exceeds threshold
    if (Math.abs(distanceX) < SWIPE_THRESHOLD) {
      return;
    }

    // Find current tab index
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    let nextIndex = currentIndex;

    // Swipe left (negative distanceX) = move to next tab
    if (distanceX > 0) {
      nextIndex = currentIndex + 1;
    }
    // Swipe right (positive distanceX) = move to previous tab
    else if (distanceX < 0) {
      nextIndex = currentIndex - 1;
    }

    // Clamp to valid range
    if (nextIndex >= 0 && nextIndex < tabs.length) {
      setActiveTab(tabs[nextIndex].id);
      // Optional: scroll the tab button into view
      scrollTabIntoView(tabs[nextIndex].id);
    }
  };

  const scrollTabIntoView = (tabId) => {
    // Find the tab button in the DOM and scroll it into view
    if (typeof document !== 'undefined') {
      const tabButton = document.querySelector(`[data-tab-id="${tabId}"]`);
      if (tabButton) {
        tabButton.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
