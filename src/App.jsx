import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useWebRTC } from './hooks/useWebRTC';
import Dashboard from './components/Dashboard';
import VideoCall from './components/VideoCall';
import Messenger from './components/Messenger';
import Dialog from './components/Dialog';

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000', { transports: ['websocket'] });
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const {
    localStream,
    remoteStream,
    personalCode,
    messages,
    inCall,
    callType,
    micActive,
    cameraActive,
    messagingReady,
    dialog,
    initiateCall,
    acceptCall,
    rejectCall,
    hangUp,
    sendMessage,
    toggleMic,
    toggleCamera,
    registerPersonalCode,
    setDialog
  } = useWebRTC(socket);

  return (
    <div className="main_container">
      <Dashboard
        personalCode={personalCode}
        onInitiateCall={initiateCall}
        onRegisterCode={registerPersonalCode}
        disabled={inCall}
      />

      <VideoCall
        localStream={localStream}
        remoteStream={remoteStream}
        inCall={inCall}
        callType={callType}
        micActive={micActive}
        cameraActive={cameraActive}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onHangUp={hangUp}
      />

      <Messenger
        messages={messages}
        onSendMessage={sendMessage}
        inCall={inCall}
        messagingReady={messagingReady}
      />

      <Dialog
        dialog={dialog}
        onAccept={acceptCall}
        onReject={() => {
          rejectCall();
          setDialog(null);
        }}
      />
    </div>
  );
}

export default App;
