import * as state from "./state.js"
import * as change from "./change.js"
import * as WebRtc from "./WebRtc.js"
import * as constants from "./constants.js"
let socketIo;
export const registerSocketEvent=(socket)=>{
    socket.on("connect",()=>{
        socketIo=socket
        console.log("successfully connected to wss server");
        //console.log(socket.id)
        state.setSocketId(socket.id)
        change.updatePersonalCode(socket.id)
    })
    socket.on('register_personal_code_answer', (data) => {
        if (data) {
            if (data.success) {
                console.log('personal code registered', data.personalCode);
                change.updatePersonalCode(data.personalCode);
            } else {
                console.log('personal code register failed', data.message);
                change.showInfoDialog('Registration failed', data.message || 'Could not register code');
            }
        }
    })
    socket.on("preOffers",(data)=>{
        console.log("getting pre offers");
        WebRtc.RecivingPreOffer(data)
    })
    socket.on("pre_offer_answer",(data)=>{
        WebRtc.handlePreOfferAnswer(data)
    })
    

    //hangup listening to the event
    socket.on("user_hanged_up",()=>{
        WebRtc.handleConnectedUserHangedUp()
    })

    socket.on("webRTC_signaling",(data)=>{
            console.log(data);
            switch (data.type){
                case constants.webRTCSingnaling.OFFER:
                    WebRtc.handleWebRTCOffer(data);
                    break;
                case constants.webRTCSingnaling.ANSWER:
                    WebRtc.handleWebRTCAnswer(data);
                    break;
                case constants.webRTCSingnaling.ICE_CANDIDATE:
                    WebRtc.handleWebRTCCandidate(data);
                    break;
                    default:
                        return;
            }
    })
}
export const preOffers=(data)=>{
    console.log("sending pre offers")
    console.log('emit preOffer', data)
    socketIo.emit("preOffer",data)
}
export const registerPersonalCode = (data) => {
    console.log('registering personal code', data)
    if (!socketIo) {
        console.log('socket not connected yet - cannot register personal code');
        change.showInfoDialog('Not connected', 'Unable to register code: not connected to server yet.');
        return;
    }
    console.log('emit register_personal_code', data)
    socketIo.emit('register_personal_code', data)
}
export const sendPreOfferAnswer=(data)=>{
    console.log('emit pre_offer_answer', data)
    socketIo.emit("pre_offer_answer",data)
}


export const sendDataUsingWebRTCSignaling=(data)=>{
    socketIo.emit("webRTC_signaling",data)
}

export const sendUserHangdUp=(data)=>{
    socketIo.emit("user_hanged_up",data)
}