import React, { useState } from 'react';
import './FileDropZone.css';

export const FileDropZone = ({ onFileDrop, children }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter((file) =>
      /\.(wav|mp3|ogg|m4a)$/i.test(file.name)
    );

    if (audioFiles.length > 0) {
      onFileDrop(audioFiles);
    }
  };

  return (
    <div
      className={`file-drop-zone ${isDragOver ? 'active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-text">Drop samples here</div>
        </div>
      )}
      {children}
    </div>
  );
};
