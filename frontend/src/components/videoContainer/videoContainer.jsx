import React, { useEffect, useState, useRef } from 'react'
import Videos from '../videos/Videos'

const uid = String(Math.floor(Math.random() * 10000));
const ws_link = `wss://raw-webrtc-jb3l.onrender.com/ws/${uid}`;
// const ws_link = `ws://192.168.1.5:8000/ws/${uid}`;
const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ]
};

export default function VideoContainer() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const remote_user_id_ref = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());

  const create_data = (type, data, from, to) => {
    return ({
      type,
      data,
      from,
      to,
    });
  }

  const create_peer_connection = async () => {
    console.log("creating peer connection");
    const pc = new RTCPeerConnection(servers);

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    })

    pc.addEventListener("track", (e) => {
      e.streams[0].getTracks().forEach((track) => {
        remoteStreamRef.current.addTrack(track);
      })
      console.log({"e.streams[]" : e.streams});
      setRemoteStream(remoteStreamRef.current);
    });

    pc.addEventListener("icecandidate", (e) => {
      // send it to server
      console.log("recieved the icecandidate");
      console.log(e.candidate)
      if(e.candidate !== null){
        const data = {
          type : "ice_candidates",
          data : e.candidate,
          from : uid,
          to : remote_user_id_ref.current,
        }
        send_msg(data);
      }
    });
    pc.addEventListener("connectionstatechange", (event) => {
      switch (pc.connectionState) {
        case "new":
          console.log("connectionstate: new")
        case "connecting":
          console.log("connectionstate: Connecting…");
          break;
        case "connected":
          console.log("connectionstate: connected");
          console.log("remoteStream.getAudioTracks(): ", remoteStreamRef.current.getAudioTracks());
          console.log("remoteStream.getVideoTracks(): ", remoteStreamRef.current.getVideoTracks());
          break;
        case "disconnected":
          console.log("connectionstate: Disconnecting…");
          break;
        case "closed":
          console.log("connectionstate: Offline");
          break;
        case "failed":
          console.log("connectionstate: Error");
          break;
        default:
          console.log("connectionstate: Unknown");
          break;
      }
    });
    // console.log("peerconnection connectionState: ", pc.connectionState);
    return pc;
  }
  const create_offer = async (remote_user_id) => {
    console.log("creating the offer");
    try {
      const pc = peerConnectionRef.current ;
      // const pc = new RTCPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      const data = create_data("offer", offer.sdp, uid, remote_user_id);
      send_msg(data);
    } catch (error) {
      console.log(error)
    }
  }
  const create_ans = async (remote_user_id, offer_sdp) => {
    console.log("creating the answer");
    try {
      const pc = peerConnectionRef.current ;
      // const pc = new RTCPeerConnection();
  
      await pc.setRemoteDescription({type : "offer", sdp : offer_sdp});
      const answer = await pc.createAnswer();
      await pc.setLocalDescription({type : answer.type, sdp : answer.sdp});
  
      const data = create_data("answer", answer.sdp, uid, remote_user_id)
      send_msg(data); 
    } catch (error) {
      console.log(error);
    }
  }

  const connect_through_websocket = async () => {
    const ws = new WebSocket(ws_link);

    ws.addEventListener("open", (e) => {
      console.log("Websocket Connection established");
    });
    
    ws.addEventListener("error", error => {
      console.error("ws error", error);
    })
    ws.addEventListener("message",async (e) =>{
      const data = JSON.parse(e.data);

      if(data.type === "create_offer"){
        console.log("create_offer triggered");
        remote_user_id_ref.current = data.from;
        await create_offer(data.from);
      }
      else if(data.type === "offer"){
        console.log("offer triggered");
        remote_user_id_ref.current = data.from;
        await create_ans(data.from, data.data);
      }
      else if(data.type === "answer"){
        console.log("answer triggered");
        
        peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription({type : "answer", sdp : data.data})
        );
      }
      else if(data.type === "ice_candidates"){
        console.log("ice_candidates triggered");
        peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.data));
      }
    });
    
    return ws;
  }
  const send_msg = (data) => {
    if(wsRef.current === null){
      throw Error("WebSocket object ws is not exists");
    }
    console.log("sending: ", data.type);
    wsRef.current.send(JSON.stringify(data));
  }
  useEffect(() => {
    const init = async () => {
      // get access of audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        audio : true,
        video: true
      })
      

      localStreamRef.current = stream;
      setLocalStream(stream);
      peerConnectionRef.current = await create_peer_connection();

      wsRef.current = await connect_through_websocket();
    }
      init();

      return (
        
        wsRef.current?.close(1000)
      );
  },[])

  const joinBtnClick = () => {}
  const newMeetingBtn = () => {}
  return (
    <>
      <div className="grid gap-[2em] grid-cols-2">
        <Videos isLocal={true} stream={localStream} />
        <Videos
          isLocal={false} 
          stream={remoteStream} 
          />
      </div>
      <div className="w-full flex gap-10 justify-center mt-10">
        <button 
          onClick={newMeetingBtn}
          className="border p-2 active:bg-slate-500"
        >New Meeting</button>
        <button 
          onClick={joinBtnClick}
          className="border p-2 active:bg-slate-500"
          >Join</button>
      </div>
    </>
  )
}