import React, { useState, useRef, useEffect } from 'react';
import { IconSend } from './Icons.jsx';

export default function ChatInput({ onSend, isLoading, disabled, placeholder }) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-input-area" id="chat-input-area">
      <form onSubmit={handleSubmit} className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={1}
            maxLength={500}
            id="chat-input-field"
            aria-label="Ketik pesan"
          />
        </div>

        <button
          type="submit"
          className="chat-send-btn"
          disabled={!message.trim() || isLoading || disabled}
          aria-label="Kirim pesan"
          id="send-btn"
        >
          {isLoading ? <span className="send-spinner" /> : <IconSend size={18} />}
        </button>
      </form>

      <p className="chat-input-hint">
        Tekan Enter untuk mengirim, Shift+Enter untuk baris baru
      </p>
    </div>
  );
}
