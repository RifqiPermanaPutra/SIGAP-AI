import React from 'react';
import Markdown from './Markdown.jsx';
import { IconUser } from './Icons.jsx';

function ChatMessage({ role, content, time }) {
  const isUser = role === 'user';

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'ai'}`}>
        {isUser ? <IconUser size={18} /> : 'AI'}
      </div>

      <div>
        <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
          {isUser ? <p>{content}</p> : <Markdown>{content}</Markdown>}
        </div>
        {time && <div className="message-time">{time}</div>}
      </div>
    </div>
  );
}

// Isi pesan tidak pernah berubah setelah dikirim, sehingga penggambaran ulang
// seluruh riwayat setiap ada pesan baru tidak diperlukan.
export default React.memo(ChatMessage);
