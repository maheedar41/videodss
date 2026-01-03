import { useEffect, useRef } from 'react';

const VideoCall = ({
  localStream,
  remoteStream,
  inCall,
  callType,
  micActive,
  cameraActive,
  onToggleMic,
  onToggleCamera,
  onHangUp
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isVideoCall = callType === 'personal_code_video';

  return (
    <div className="call_container">
      <div className="videos_container">
        <div className={`videos_placeholder ${inCall && remoteStream ? 'display_none' : ''}`}>
          <img src="./utils/images/project_logo-removebg-preview.png" alt="Logo" />
        </div>

        <video
          ref={remoteVideoRef}
          className={`remote_video ${!inCall || !remoteStream ? 'display_none' : ''}`}
          autoPlay
          playsInline
        />

        <div className="local_video_container">
          <video
            ref={localVideoRef}
            className="local_video"
            autoPlay
            muted
            playsInline
          />
        </div>

        {inCall && isVideoCall && (
          <div className="call_buttons_container">
            <button className="call_button_small" onClick={onToggleMic}>
              <img
                src={micActive ? './utils/images/mic.png' : './utils/images/micOff.png'}
                alt="Mic"
              />
            </button>
            <button className="call_button_small" onClick={onToggleCamera}>
              <img
                src={cameraActive ? './utils/images/camera.png' : './utils/images/cameraOff.png'}
                alt="Camera"
              />
            </button>
            <button className="call_button_large" onClick={onHangUp}>
              <img src="./utils/images/hangUp.png" alt="Hang Up" />
            </button>
            <button className="call_button_small">
              <img src="./utils/images/switchCameraScreenSharing.png" alt="Screen Share" />
            </button>
            <button className="call_button_small">
              <img src="./utils/images/recordingStart.png" alt="Record" />
            </button>
          </div>
        )}

        {inCall && !isVideoCall && (
          <div className="finish_chat_button_container">
            <button className="call_button_large" onClick={onHangUp}>
              <img src="./utils/images/hangUp.png" alt="Hang Up" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
