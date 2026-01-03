import { useState, useEffect, useRef } from 'react';

const Messenger = ({ messages, onSendMessage, inCall, messagingReady }) => {
  const [newMessage, setNewMessage] = useState('');
  const messageContainerRef = useRef(null);

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim() && messagingReady) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && newMessage.trim() && messagingReady) {
      handleSend();
    }
  };

  return (
    <div className="messenger_container">
      <div className="message_container" ref={messageContainerRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={msg.isOwn ? 'message_right_container' : 'message_left_container'}
          >
            <p className={msg.isOwn ? 'message_right_paragraph' : 'message_left_paragraph'}>
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {inCall && (
        <div className="new_message_container">
          <input
            className="new_message_input"
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!messagingReady}
            style={{ opacity: messagingReady ? 1 : 0.6 }}
          />
          <button
            className="send_message_button"
            onClick={handleSend}
            disabled={!messagingReady}
            style={{ opacity: messagingReady ? 1 : 0.6 }}
          >
            <img
              className="send_message_button_image"
              src="./utils/images/sendMessageButton.png"
              alt="Send"
            />
          </button>
        </div>
      )}
    </div>
  );
};

export default Messenger;
