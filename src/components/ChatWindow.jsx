import React, { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage.jsx';
import EngineerButton from './EngineerButton.jsx';
import QuickReplies from './QuickReplies.jsx';
import ConfirmReplies from './ConfirmReplies.jsx';
import { IconHeadset, IconArrowDown, DivisionIcon } from './Icons.jsx';

export default function ChatWindow({
  messages,
  isLoading,
  showEngineerBtn,
  onEngineerContact,
  division,
  onQuickReply,
  menungguKonfirmasi,
  saranDivisi,
  onPilihDivisi
}) {
  const chatEndRef = useRef(null);
  const areaRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Gulir instan lewat scrollTop. Sengaja TIDAK memakai scrollIntoView,
  // scrollTo({behavior:'smooth'}), maupun CSS scroll-behavior: pada sebagian
  // mesin render permintaan gulir halus diabaikan diam-diam sehingga posisi
  // tidak berubah sama sekali. Lompatan instan adalah perilaku lazim di
  // antarmuka percakapan dan dijamin berjalan di semua peramban.
  const scrollToBottom = () => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Auto-scroll hanya bila pengguna sedang berada di dekat bagian bawah,
  // supaya tidak menyentak saat ia menggulir ke atas membaca riwayat.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) scrollToBottom();
  }, [messages, isLoading]);

  // Tampilkan tombol "ke bawah" saat riwayat digulir jauh ke atas
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Saran ditawarkan hanya di awal percakapan, saat pengguna belum bertanya
  const showSuggestions =
    division &&
    !isLoading &&
    !showEngineerBtn &&
    messages.length > 0 &&
    !messages.some((m) => m.role === 'user');

  return (
    <div
      className="chat-area"
      id="chat-window"
      ref={areaRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconHeadset size={30} /></div>
          <h2 className="empty-state-title">SIGAP</h2>
          <p className="empty-state-desc">
            Siap membantu Anda menyelesaikan kendala layanan ICT di Field Lirik.
          </p>
        </div>
      ) : (
        <>
          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              role={msg.role}
              content={msg.content}
              time={msg.time}
            />
          ))}

          {isLoading && (
            <div className="typing-indicator">
              <div className="message-avatar ai">SG</div>
              <div className="typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {showSuggestions && (
            <QuickReplies
              divisionId={division.id}
              onPick={onQuickReply}
              disabled={isLoading}
            />
          )}

          {/* Penentuan layanan otomatis belum cukup meyakinkan — pengguna
              yang memilih, karena salah tebak berarti laporannya sampai ke
              engineer yang keliru. */}
          {saranDivisi?.length > 0 && !isLoading && (
            <div className="saran-divisi" id="saran-divisi">
              <p className="saran-divisi-label">Pilih layanan yang paling sesuai</p>
              <div className="saran-divisi-list">
                {saranDivisi.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="saran-divisi-item"
                    onClick={() => onPilihDivisi(d.id)}
                  >
                    <DivisionIcon id={d.id} size={18} />
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hanya salah satu yang tampil: selagi masih ada langkah untuk
              dicoba, pilihannya "sudah/belum"; setelah langkahnya habis,
              barulah tombol engineer. */}
          {menungguKonfirmasi && !isLoading && !showEngineerBtn && (
            <ConfirmReplies onPick={onQuickReply} disabled={isLoading} />
          )}

          {showEngineerBtn && (
            <EngineerButton onClick={onEngineerContact} />
          )}
        </>
      )}

      <div ref={chatEndRef} />

      {showScrollBtn && (
        <button
          className="scroll-bottom-btn"
          onClick={() => scrollToBottom()}
          aria-label="Gulir ke pesan terbaru"
          id="scroll-bottom-btn"
        >
          <IconArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
