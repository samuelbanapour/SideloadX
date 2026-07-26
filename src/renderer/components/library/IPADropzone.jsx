import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export default function IPADropzone({ onFileSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.ipa')) {
        setUploading(true);
        try {
          await onFileSelected(file.path || file.name);
        } finally {
          setUploading(false);
        }
      }
    }
  }, [onFileSelected]);

  const handleClick = useCallback(async () => {
    if (window.api) {
      const filePath = await window.api.ipa.pickFile();
      if (filePath) {
        setUploading(true);
        try {
          await onFileSelected(filePath);
        } finally {
          setUploading(false);
        }
      }
    }
  }, [onFileSelected]);

  return (
    <motion.div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={clsx(
        'dropzone',
        isDragOver && 'dropzone-active animate-pulse-border',
        uploading && 'pointer-events-none opacity-70'
      )}
    >
      {uploading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <FileArchive size={48} className="text-accent" />
          </motion.div>
          <p className="text-surface-300">Processing IPA...</p>
        </>
      ) : isDragOver ? (
        <>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <CheckCircle size={48} className="text-success" />
          </motion.div>
          <p className="text-success font-medium">Release to upload</p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center">
            <Upload size={32} className="text-surface-400" />
          </div>
          <div className="text-center">
            <p className="text-surface-300 font-medium">
              Drag & drop an IPA file here
            </p>
            <p className="text-surface-500 text-sm mt-1">
              or click to browse
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
}
