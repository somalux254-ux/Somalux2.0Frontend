import React, { createContext, useContext, useState } from 'react';
import SimpleScrollReader from '../Books/SimpleScrollReader';

const ReaderAudioContext = createContext(null);

export const ReaderAudioProvider = ({ children }) => {
  const [readerBook, setReaderBook] = useState(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const openBookDetails = () => {
    setIsReaderOpen(true);
  };

  const openReader = (book) => {
    setReaderBook(book);
    setIsReaderOpen(true);
  };

  const closeReaderView = () => {
    setIsReaderOpen(false);
  };

  const closeReaderAudio = () => {
    setIsReaderOpen(false);
    setReaderBook(null);
  };

  return (
    <ReaderAudioContext.Provider value={{ openReader, closeReaderView, isReaderOpen, openBookDetails }}>
      {children}
      {readerBook && (
        <SimpleScrollReader
          src={readerBook.downloadUrl}
          cacheKey={`book:${readerBook.id}`}
          title={readerBook.title}
          author={readerBook.author}
          sampleText={readerBook.sampleText || readerBook.description}
          isOpen={isReaderOpen}
          onClose={closeReaderView}
          onAudioClose={closeReaderAudio}
          onOpenBookDetails={openBookDetails}
        />
      )}
    </ReaderAudioContext.Provider>
  );
};

export const useReaderAudio = () => {
  const context = useContext(ReaderAudioContext);
  if (!context) throw new Error('useReaderAudio must be used within ReaderAudioProvider');
  return context;
};
