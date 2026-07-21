import React from 'react';
import ReactMarkdown from 'react-markdown';
import { IconUser } from './Icons.jsx';

export default function ChatMessage({ role, content, time }) {
  const isUser = role === 'user';

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'ai'}`}>
        {isUser ? <IconUser size={18} /> : 'AI'}
      </div>

      <div>
        <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
          {isUser ? (
            <p>{content}</p>
          ) : (
            <ReactMarkdown
              components={{
                // Custom renderers for clean markdown output
                p: ({ children }) => <p>{children}</p>,
                strong: ({ children }) => <strong>{children}</strong>,
                em: ({ children }) => <em>{children}</em>,
                ul: ({ children }) => <ul>{children}</ul>,
                ol: ({ children }) => <ol>{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                code: ({ children }) => <code>{children}</code>,
                h1: ({ children }) => <h3>{children}</h3>,
                h2: ({ children }) => <h3>{children}</h3>,
                h3: ({ children }) => <h3>{children}</h3>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
        {time && <div className="message-time">{time}</div>}
      </div>
    </div>
  );
}
