import { useState } from 'react';

const Dashboard = ({ personalCode, onInitiateCall, onRegisterCode, disabled }) => {
  const [targetCode, setTargetCode] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');

  const handleCopyCode = () => {
    if (navigator.clipboard && personalCode) {
      navigator.clipboard.writeText(personalCode);
    }
  };

  const handleSetFallbackCode = () => {
    if (fallbackCode.trim()) {
      onRegisterCode(fallbackCode.trim());
      setFallbackCode('');
    }
  };

  return (
    <div className="dashboard_container">
      <div className="logo_container">
        <img src="./utils/images/FaceTime.png" alt="FaceTime Logo" />
      </div>

      <div>
        <div className="description_container">
          <p className="description_container_paragraph">
            Talk with other user by passing his personal code or talk with strangers!
          </p>
        </div>

        <div className="personal_code_container">
          <div className="personal_code_title_container">
            <p className="personal_code_title_paragraph">Your personal code</p>
          </div>
          <div className="personal_code_value_container">
            <p className="personal_code_value_paragraph">{personalCode || 'Loading...'}</p>
            <button className="personal_code_copy_button" onClick={handleCopyCode}>
              <img src="./utils/images/copyButton.png" alt="Copy" />
            </button>
          </div>
        </div>

        <div className="personal_code_fallback_block">
          <input
            className="fallback_input"
            placeholder="Set fixed code (fallback)"
            value={fallbackCode}
            onChange={(e) => setFallbackCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetFallbackCode()}
          />
          <button className="fallback_set_button" onClick={handleSetFallbackCode}>
            Set
          </button>
        </div>

        <div className="personal_code_connecting_container">
          <p className="personal_code_connecting_paragraph">Personal Code</p>
          <div className="personal_code_connecting_input_container">
            <input
              className="personal_code_input"
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value)}
              placeholder="Enter personal code"
            />
          </div>
          <div className="personal_code_connecting_buttons_container">
            <button
              className="connecting_button"
              onClick={() => targetCode && onInitiateCall('personal_code_chat', targetCode)}
            >
              <img src="./utils/images/chatButton.png" className="connecting_buttons_image" alt="Chat" />
            </button>
            <button
              className="connecting_button"
              onClick={() => targetCode && onInitiateCall('personal_code_video', targetCode)}
            >
              <img src="./utils/images/videoButton.png" className="connecting_buttons_image" alt="Video" />
            </button>
          </div>
        </div>

        <div className="stranger_connecting_container">
          <p className="stranger_title_container">Stranger</p>
          <div className="stranger_buttons_container">
            <button className="connecting_button">
              <img src="./utils/images/chatButton.png" className="connecting_buttons_image" alt="Chat" />
            </button>
            <button className="connecting_button">
              <img src="./utils/images/videoButton.png" className="connecting_buttons_image" alt="Video" />
            </button>
          </div>
        </div>

        <div className="checkbox_container">
          <div className="checkbox_connection">
            <img src="./utils/images/check.png" alt="Check" />
          </div>
          <p className="checkbox_container_paragraph">Allow connection from strangers</p>
        </div>

        {disabled && <div className="dashboard_blur" />}
      </div>
    </div>
  );
};

export default Dashboard;
