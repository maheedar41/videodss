import { useEffect, useState, useRef, useCallback } from 'react';

const configuration = {
  iceServers: [{ urls: 'stun:stun.1.google.com:13902' }]
};

const defaultConstraints = {
  audio: true,
  video: true
};

export const useWebRTC = (socket) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [personalCode, setPersonalCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [messagingReady, setMessagingReady] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('user');
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const connectedUserDetailsRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const dataChannelMessageQueueRef = useRef([]);

  const getLocalPreview = useCallback(async (facingMode = 'user') => {
    try {
      const constraints = {
        audio: true,
        video: { facingMode }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.log('Error accessing camera:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    getLocalPreview();
  }, [getLocalPreview]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      setPersonalCode(socket.id);
    });

    socket.on('register_personal_code_answer', (data) => {
      if (data && data.success) {
        console.log('Personal code registered:', data.personalCode);
        setPersonalCode(data.personalCode);
      } else {
        console.log('Personal code register failed:', data?.message);
        setDialog({
          type: 'info',
          title: 'Registration failed',
          description: data?.message || 'Could not register code'
        });
        setTimeout(() => setDialog(null), 3000);
      }
    });

    socket.on('preOffers', (data) => {
      console.log('Received pre-offer:', data);
      handlePreOffer(data);
    });

    socket.on('pre_offer_answer', (data) => {
      console.log('Received pre-offer answer:', data);
      handlePreOfferAnswer(data);
    });

    socket.on('webRTC_signaling', (data) => {
      console.log('Received WebRTC signaling:', data);
      handleWebRTCSignaling(data);
    });

    socket.on('user_hanged_up', () => {
      console.log('User hung up');
      handleConnectedUserHangedUp();
    });

    return () => {
      socket.off('connect');
      socket.off('register_personal_code_answer');
      socket.off('preOffers');
      socket.off('pre_offer_answer');
      socket.off('webRTC_signaling');
      socket.off('user_hanged_up');
    };
  }, [socket]);

  const handlePreOffer = (data) => {
    const { connection_type, personal_code } = data;
    isInitiatorRef.current = false;
    connectedUserDetailsRef.current = {
      socketId: personal_code,
      connection_type
    };

    const callTypeText = connection_type === 'personal_code_chat' ? 'Chat' : 'Video';
    setDialog({
      type: 'incoming',
      callType: callTypeText
    });
  };

  const handlePreOfferAnswer = async (data) => {
    const { preOfferAnswer } = data;
    console.log('Pre-offer answer:', preOfferAnswer);

    setDialog(null);

    if (preOfferAnswer === 'Not_Found') {
      setDialog({
        type: 'info',
        title: 'Not Found',
        description: 'Client Already Disconnected or Wrong Personal Code'
      });
      setTimeout(() => setDialog(null), 3000);
      return;
    }

    if (preOfferAnswer === 'Call_Unavailable') {
      setDialog({
        type: 'info',
        title: 'Unavailable',
        description: 'Client Is Busy'
      });
      setTimeout(() => setDialog(null), 3000);
      return;
    }

    if (preOfferAnswer === 'Call_Rejected') {
      setDialog({
        type: 'info',
        title: 'Call Rejected',
        description: 'Client Rejected the Call'
      });
      setTimeout(() => setDialog(null), 3000);
      return;
    }

    if (preOfferAnswer === 'Call_Accepted') {
      setInCall(true);
      setCallType(connectedUserDetailsRef.current.connection_type);
      const ok = await createPeerConnection();
      if (ok) {
        await sendWebRTCOffer();
      }
    }
  };

  const handleWebRTCSignaling = async (data) => {
    switch (data.type) {
      case 'OFFER':
        await handleWebRTCOffer(data);
        break;
      case 'ANSWER':
        await handleWebRTCAnswer(data);
        break;
      case 'ICE_CANDIDATE':
        await handleWebRTCCandidate(data);
        break;
      default:
        break;
    }
  };

  const createPeerConnection = async () => {
    try {
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      if (isInitiatorRef.current) {
        dataChannelRef.current = peerConnectionRef.current.createDataChannel('chat');
        setupDataChannelHandlers(dataChannelRef.current);
      }

      peerConnectionRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        setupDataChannelHandlers(dataChannelRef.current);
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webRTC_signaling', {
            connectedUserSocketId: connectedUserDetailsRef.current.socketId,
            type: 'ICE_CANDIDATE',
            candidate: event.candidate
          });
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnectionRef.current.connectionState);
      };

      const newRemoteStream = new MediaStream();
      setRemoteStream(newRemoteStream);

      peerConnectionRef.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          newRemoteStream.addTrack(track);
        });
      };

      if (connectedUserDetailsRef.current.connection_type === 'personal_code_video') {
        let stream = localStream;
        if (!stream) {
          stream = await getLocalPreview();
          if (!stream) {
            setDialog({
              type: 'info',
              title: 'ERROR',
              description: 'Could not access camera/microphone. Call cannot proceed.'
            });
            setTimeout(() => setDialog(null), 3000);
            return false;
          }
        }
        stream.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, stream);
        });
      }

      return true;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      return false;
    }
  };

  const setupDataChannelHandlers = (channel) => {
    channel.onopen = () => {
      console.log('Data channel opened');
      setMessagingReady(true);
      while (dataChannelMessageQueueRef.current.length > 0 && channel.readyState === 'open') {
        const msg = dataChannelMessageQueueRef.current.shift();
        try {
          channel.send(JSON.stringify(msg));
        } catch (e) {
          console.log('Send queue error:', e);
          break;
        }
      }
    };

    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prev) => [...prev, { text: message, isOwn: false }]);
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      setMessagingReady(false);
    };

    channel.onerror = (err) => {
      console.log('Data channel error:', err);
    };
  };

  const sendWebRTCOffer = async () => {
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit('webRTC_signaling', {
        connectedUserSocketId: connectedUserDetailsRef.current.socketId,
        type: 'OFFER',
        offer: offer
      });
    } catch (err) {
      console.error('Error sending WebRTC offer:', err);
    }
  };

  const handleWebRTCOffer = async (data) => {
    try {
      await peerConnectionRef.current.setRemoteDescription(data.offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit('webRTC_signaling', {
        connectedUserSocketId: connectedUserDetailsRef.current.socketId,
        type: 'ANSWER',
        answer: answer
      });
    } catch (err) {
      console.error('Error handling WebRTC offer:', err);
    }
  };

  const handleWebRTCAnswer = async (data) => {
    try {
      await peerConnectionRef.current.setRemoteDescription(data.answer);
    } catch (err) {
      console.error('Error handling WebRTC answer:', err);
    }
  };

  const handleWebRTCCandidate = async (data) => {
    try {
      await peerConnectionRef.current.addIceCandidate(data.candidate);
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  };

  const initiateCall = (connectionType, targetCode) => {
    console.log('Initiating call:', connectionType, targetCode);
    isInitiatorRef.current = true;
    connectedUserDetailsRef.current = {
      connection_type: connectionType,
      socketId: targetCode
    };

    setDialog({ type: 'calling' });

    socket.emit('preOffer', {
      connection_type: connectionType,
      personal_code: targetCode
    });
  };

  const acceptCall = async () => {
    console.log('Call accepted');
    setDialog(null);
    setInCall(true);
    setCallType(connectedUserDetailsRef.current.connection_type);
    const ok = await createPeerConnection();
    if (ok) {
      socket.emit('pre_offer_answer', {
        callerSocketId: connectedUserDetailsRef.current.socketId,
        preOfferAnswer: 'Call_Accepted'
      });
    }
  };

  const rejectCall = () => {
    console.log('Call rejected');
    setDialog(null);
    socket.emit('pre_offer_answer', {
      callerSocketId: connectedUserDetailsRef.current.socketId,
      preOfferAnswer: 'Call_Rejected'
    });
    connectedUserDetailsRef.current = null;
  };

  const hangUp = () => {
    console.log('Hanging up');
    if (socket && connectedUserDetailsRef.current) {
      socket.emit('user_hanged_up', {
        connectedUserSocketId: connectedUserDetailsRef.current.socketId
      });
    }
    closePeerConnectionAndResetState();
  };

  const handleConnectedUserHangedUp = () => {
    closePeerConnectionAndResetState();
  };

  const closePeerConnectionAndResetState = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current = null;
    }

    if (connectedUserDetailsRef.current?.connection_type === 'personal_code_video' && localStream) {
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      if (videoTracks[0]) videoTracks[0].enabled = true;
      if (audioTracks[0]) audioTracks[0].enabled = true;
    }

    setInCall(false);
    setCallType(null);
    setRemoteStream(null);
    setMessages([]);
    setMessagingReady(false);
    setMicActive(true);
    setCameraActive(true);
    connectedUserDetailsRef.current = null;
    isInitiatorRef.current = false;
    dataChannelMessageQueueRef.current = [];
  };

  const sendMessage = (message) => {
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { text: message, isOwn: true }]);

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.log('Data channel not open, queueing message');
      dataChannelMessageQueueRef.current.push(message);
      return;
    }

    try {
      dataChannelRef.current.send(JSON.stringify(message));
    } catch (err) {
      console.log('Error sending message, queueing:', err);
      dataChannelMessageQueueRef.current.push(message);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks[0]) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setMicActive(audioTracks[0].enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks[0]) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setCameraActive(videoTracks[0].enabled);
      }
    }
  };

  const registerPersonalCode = (code) => {
    if (!socket) {
      console.log('Socket not connected');
      setDialog({
        type: 'info',
        title: 'Not connected',
        description: 'Unable to register code: not connected to server yet.'
      });
      setTimeout(() => setDialog(null), 3000);
      return;
    }

    console.log('Registering personal code:', code);
    socket.emit('register_personal_code', { personalCode: code });
  };

  const rotateCamera = async () => {
    try {
      const newFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      const stream = await getLocalPreview(newFacingMode);
      if (stream) {
        setCameraFacingMode(newFacingMode);

        if (peerConnectionRef.current && inCall) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = peerConnectionRef.current
            .getSenders()
            .find((s) => s.track?.kind === 'video');

          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }
    } catch (err) {
      console.error('Error rotating camera:', err);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return {
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
    isMuted,
    cameraFacingMode,
    initiateCall,
    acceptCall,
    rejectCall,
    hangUp,
    sendMessage,
    toggleMic,
    toggleCamera,
    rotateCamera,
    toggleMute,
    registerPersonalCode,
    setDialog
  };
};
