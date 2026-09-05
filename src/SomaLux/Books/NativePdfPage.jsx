import React, { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';

const NativePdfRenderer = registerPlugin('NativePdfRenderer');
const documentInfoCache = new Map();
const pageImageCache = new Map();
const pageRenderCache = new Map();

const prefetchNativePdf = (source) => {
  if (!source) return Promise.reject(new Error('A PDF source is required'));
  if (!documentInfoCache.has(source)) {
    documentInfoCache.set(source, NativePdfRenderer.getDocumentInfo({ source }));
  }
  return documentInfoCache.get(source);
};

const NativePdfPage = ({ source, pageNumber, width, onRenderSuccess, onRenderError }) => {
  const [image, setImage] = useState(null);
  const callbacksRef = useRef({ onRenderSuccess, onRenderError });
  callbacksRef.current = { onRenderSuccess, onRenderError };
  const displayWidth = Math.round(width || 1600);
  const renderWidth = Math.min(Math.max(Math.round(displayWidth * 1.5), 1000), 2400);
  const imageCacheKey = `${source}:${pageNumber}:${renderWidth}`;

  useEffect(() => {
    let active = true;
    const renderPage = () => {
      const cachedImage = pageImageCache.get(imageCacheKey);
      if (cachedImage) {
        setImage(cachedImage);
        callbacksRef.current.onRenderSuccess?.();
        return;
      }

      let renderPromise = pageRenderCache.get(imageCacheKey);
      if (!renderPromise) {
        renderPromise = prefetchNativePdf(source).then(() => NativePdfRenderer.renderPage({
          source,
          pageNumber,
          width: renderWidth,
        }));
        pageRenderCache.set(imageCacheKey, renderPromise);
      }

      renderPromise.then(({ data }) => {
        if (!active) return;
        const nextImage = `data:image/png;base64,${data}`;
        pageImageCache.set(imageCacheKey, nextImage);
        setImage(nextImage);
        callbacksRef.current.onRenderSuccess?.();
      }).catch(error => {
        pageRenderCache.delete(imageCacheKey);
        if (active) callbacksRef.current.onRenderError?.(error);
      });
    };

    renderPage();

    return () => {
      active = false;
    };
  }, [source, pageNumber, renderWidth, imageCacheKey]);

  return image ? (
    <img
      className="native-pdf-page"
      src={image}
      alt={`Page ${pageNumber}`}
      style={{ width: `${displayWidth}px`, height: 'auto' }}
      draggable="false"
    />
  ) : (
    <div className="native-pdf-page-loading" aria-label={`Loading page ${pageNumber}`} />
  );
};

export { NativePdfRenderer, prefetchNativePdf };
export default NativePdfPage;
