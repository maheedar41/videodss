import * as events from "./event.js";
import * as change from "./change.js";
import * as state from "./state.js";
import * as constants from "./constants.js"
// <---------- Sending offer to the other user ------------>

let connectedUserDetails;
let peerConnection;
let dataChannel;
let dataChannelMessageQueue = [];
let isInitiator = false;
const defaultConstraints = {
    audio: true,
    video: true
}
const configuration = {
    iceServers: [
        {
            urls: "stun:stun.1.google.com:13902"
        }
    ]
}
export const getLocalPreview = () => {
    navigator.mediaDevices.getUserMedia(defaultConstraints)
        .then((stream) => {
            change.updateLocalVideo(stream);
            state.setLocalStream(stream);
        }).catch((err) => {
            console.log("error occured when trying to access camera", err)
        })
}
const createPeerConnection = async () => {
    peerConnection = new RTCPeerConnection(configuration);
    // create data channel only if this side initiated the call
    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel("chat");
        // if we created the dataChannel locally, set handlers on it
        if (dataChannel) {
            dataChannel.onopen = () => {
                console.log("data channel opened (local)");
                while (dataChannelMessageQueue.length > 0 && dataChannel && dataChannel.readyState === 'open') {
                    const msg = dataChannelMessageQueue.shift();
                    try { dataChannel.send(JSON.stringify(msg)); } catch (e) { console.log('send queue error', e); break; }
                }
                try { change.setMessagingReady(true); } catch(e){console.log('change.setMessagingReady not available', e)}
            };
            dataChannel.onmessage = (event) => {
                console.log('message came from data channel (local)');
                const message = JSON.parse(event.data);
                change.appendMessage(message);
            };
        }
    }
    

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;

        dataChannel.onopen = () => {
            console.log("data channel opened for messages")
            // flush queued messages
            while (dataChannelMessageQueue.length > 0 && dataChannel && dataChannel.readyState === 'open') {
                const msg = dataChannelMessageQueue.shift();
                try { dataChannel.send(JSON.stringify(msg)); } catch (e) { console.log('send queue error', e); break; }
            }
            try { change.setMessagingReady(true); } catch(e){console.log('change.setMessagingReady not available', e)}
        }
        dataChannel.onmessage = (event) => {
            console.log('message came from data channel');
            const message = JSON.parse(event.data);
            change.appendMessage(message);
        }
        dataChannel.onclose = () => { try { change.setMessagingReady(false); } catch(e){}; console.log('dataChannel closed'); }
        dataChannel.onerror = (err) => { console.log('dataChannel error', err); }
    }
    console.log(peerConnection);
    peerConnection.onicecandidate = (event) => {
        console.log("geeting ice candidates from stun server")
        if (event.candidate) {
            //sending our ice candiadate to other peer
            events.sendDataUsingWebRTCSignaling({
                connectedUserSocketId: connectedUserDetails.socketId,
                type: constants.webRTCSingnaling.ICE_CANDIDATE,
                candidate: event.candidate
            })
        }
    }
    peerConnection.onconnectionstatechange = (event) => {
        console.log('peerConnection state:', peerConnection.connectionState)
        if (peerConnection.connectionState === "connected") {
            console.log("successfully connected to other peer")
        }
    }
    //receiving track
    const remoteStream = new MediaStream();
    state.setRemoteStream(remoteStream);
    change.updateRemoteVideo(remoteStream);
    peerConnection.ontrack = (event) => {
        remoteStream.addTrack(event.track);
    }
    //add our stream to peer connection
    if (connectedUserDetails.connection_type === "personal_code_video") {
        let localStream = state.getState().localStream;
        if (!localStream) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
                change.updateLocalVideo(localStream);
                state.setLocalStream(localStream);
            } catch (err) {
                console.log("error occured when trying to access camera", err)
                change.showInfoDialog("ERROR", "Could not access camera/microphone. Call cannot proceed.");
                return false;
            }
        }
        for (const track of localStream.getTracks()) {
            peerConnection.addTrack(track, localStream)
        }
    }
    return true;
}

export const sendMessageUsingDataChannel = (message) => {
    const stringifiedMessage = JSON.stringify(message);
    if (!dataChannel) {
        console.log('dataChannel not established yet, queueing message');
        dataChannelMessageQueue.push(message);
        return;
    }
    if (dataChannel.readyState !== 'open') {
        console.log('dataChannel not open, queueing message');
        dataChannelMessageQueue.push(message);
        return;
    }
    try {
        dataChannel.send(stringifiedMessage);
    } catch (err) {
        console.log('error sending over dataChannel, queueing', err);
        dataChannelMessageQueue.push(message);
    }
}

export const preOffers = (connection_type, personal_code) => {
    console.log(connection_type, personal_code)
    isInitiator = true;
    connectedUserDetails = {
        connection_type,
        socketId: personal_code
    }
    if (connection_type == "personal_code_chat" || connection_type == "personal_code_video") {
        let data = {
            connection_type,
            personal_code
        }
        change.showCallingPopUp(callingDialogRejectCallHandler)
        events.preOffers(data)
    }
}
export const RecivingPreOffer = (data) => {
    console.log("WebRtc got pre offer")
    console.log(data);
    const { connection_type, personal_code } = data
    isInitiator = false;
    connectedUserDetails = {
        socketId: personal_code,
        connection_type
    }
    if (connection_type == "personal_code_chat" || connection_type == "personal_code_video") {
        change.showIncomingPopUp(connection_type, acceptCall, rejectCall)
    }
}
const acceptCall = async () => {
    console.log("call accepted")
    const ok = await createPeerConnection();
    if (!ok) return;
    sendPreOfferAnswer("Call_Accepted");
    change.showCallElements(connectedUserDetails.connection_type)

}
const rejectCall = () => {
    console.log("call rejected")
    sendPreOfferAnswer("Call_Rejected");
}
const callingDialogRejectCallHandler = () => {
    console.log("Rejecting call!!")
}
const sendPreOfferAnswer = (preOfferAnswer) => {
    const data = {
        callerSocketId: connectedUserDetails.socketId,
        preOfferAnswer
    }
    change.removeAllDialogs();
    events.sendPreOfferAnswer(data);
}

export const handlePreOfferAnswer = async (data) => {
    const { preOfferAnswer } = data;
    console.log("pre offer answers came")
    console.log(data);
    change.removeAllDialogs();
    if (preOfferAnswer === "Not_Found") {
        change.showInfoDialog(preOfferAnswer)
        //if not found
    }
    if (preOfferAnswer === "Call_Unavailable") {
        change.showInfoDialog(preOfferAnswer)
    }
    if (preOfferAnswer === "Call_Rejected") {
        change.showInfoDialog(preOfferAnswer)
    }
    if (preOfferAnswer === "Call_Accepted") {
        //send webrtc offer
        change.showCallElements(connectedUserDetails.connection_type)
        const ok = await createPeerConnection();
        if (!ok) return;
        sendWebRTCOffer();
    }
}

const sendWebRTCOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer)
    events.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSingnaling.OFFER,
        offer: offer
    })
}

export const handleWebRTCOffer = async (data) => {
    console.log("webRTC offer came");
    console.log(data);
    await peerConnection.setRemoteDescription(data.offer)

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer)
    events.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSingnaling.ANSWER,
        answer: answer
    })
}

export const handleWebRTCAnswer = async (data) => {
    console.log("handeling webRTC Answer")
    console.log(data);
    await peerConnection.setRemoteDescription(data.answer)
}

export const handleWebRTCCandidate = async (data) => {
    console.log("handeling incoming webRTC candidate")
    try {
        await peerConnection.addIceCandidate(data.candidate);

    } catch (err) {
        console.log("error occured when trying to add recived ice candidate", err)
    }
}

export const switchBetweenCameraAndScreenSharing = async (screenSharingActive) => {
    if (screenSharingActive) {

    } else {
        console.log("switching for screen sharing")

        try {
            screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            })
            state.setScreenSharingStream(screenSharingStream)

            //replacing track which sender is sending
            const senders = peerConnection.getSenders();

            const sender = sender.find((sender) => {
                return (
                    sender.track.kind === screenSharingStream.getVideoTracks()[0].kind
                )
            })

            if (sender) {
                sender.replaceTrack(screenSharingStream.getVideoTracks()[0]);
            }

            state.setScreenSharingActive(!screenSharingActive)

            change.updateLocalVideo(screenSharingStream)
        } catch (error) {
            console.log("error occured when trying to get screen sharing", error)
        }
    }
}

//hang up
export const handleHangUp = () => {
    console.log("call ended")
    const data = {
        connectedUserSocketId: connectedUserDetails.socketId,

    }
    events.sendUserHangdUp(data);
    closePeerConnectionAndResetState();
}

export const handleConnectedUserHangedUp = () => {
    console.log("connected client hanged up")
    closePeerConnectionAndResetState();
}

const closePeerConnectionAndResetState = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    //active mic and camera
    if (connectedUserDetails && connectedUserDetails.connection_type === "personal_code_video") {
        const localStream = state.getState().localStream;
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            if (videoTracks && videoTracks[0]) videoTracks[0].enabled = true;
            if (audioTracks && audioTracks[0]) audioTracks[0].enabled = true;
        }
    }

    change.updateUIAfterHangUp(connectedUserDetails.connection_type)
    connectedUserDetails = null
    isInitiator = false;
}