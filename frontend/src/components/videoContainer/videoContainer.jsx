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
  const peerConnectionRef = useRef(new RTCPeerConnection());
  const localStreamRef = useRef(new MediaStream());
  const remoteStreamRef = useRef(new MediaStream());
  const dataChannelRef = useRef(null);

  const [message, setMessage] = useState([]);
  const [input_val, setInputValue] = useState("");

  const [isScreenShare, setIsScreenShare] = useState(false);

  const speechRecognitionRef = useRef(new SpeechRecognition());
  const [localSubtitle, setLocalSubtitle] = useState("");
  const [remoteSubtitle, setRemoteSubtitle] = useState("");
  
  const create_data = (type, data, from, to) => ({
      type,
      data,
      from,
      to,
    });
  
  const create_msg_data = (type, data) => ({
    type,
    data,
  })

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
    pc.addEventListener("datachannel", (e)=> {
      dataChannelRef.current = e.channel;
      add_events_to_datachannel(dataChannelRef.current);
      console.log(dataChannelRef.current.readyState);
    });
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
        await create_data_channel();
        await create_offer(data.from);
      }
      else if(data.type === "offer"){
        console.log("offer triggered");
        remote_user_id_ref.current = data.from;
        await create_ans(data.from, data.data);
      }
      else if(data.type === "answer"){
        console.log("answer triggered");
        
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription({type : "answer", sdp : data.data})
        );
      }
      else if(data.type === "ice_candidates"){
        console.log("ice_candidates triggered");
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.data));
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
  const send_msg_through_data_channel = (data) => {
    console.log("sending msg through data channel: ", data);
    const data_channel = dataChannelRef.current;
    if(!data_channel){
      console.log("data channel is not established yet...");
    }
    else{
      data_channel.send(data);
      console.log("sending msg: "+ data);
    }
  }
  const add_events_to_datachannel = (data_channel)=>{
    data_channel.addEventListener("open", (e) => {
      console.log("Data channel open");
    });
    data_channel.addEventListener("message", (e) => {
      const type = e.data.type;
      console.log("message received", e.data);
      console.log("channel state:", data_channel.readyState);

      if(type === "chat"){
        setMessage(prev => [...prev, {
          text : e.data.data,
          sender : "remote",
        }]);
      }
      else if(type === "subtitle"){
        setRemoteSubtitle(e.data.data);
      }
    });
    data_channel.addEventListener("error", (e) => {
      console.log(e.error);
    });
    data_channel.addEventListener("close", (e) => {
      console.log("data channel closed")
    });
    data_channel.addEventListener("closing", (e) => {
      console.log("closing the data channel...");
    });
  }
  const create_data_channel = async () => {
    console.log("creating the datachannel...")
    const pc = peerConnectionRef.current;
    const data_channel = pc.createDataChannel("raw-rtc-chat");
    dataChannelRef.current = data_channel;

    add_events_to_datachannel(data_channel);
    

  }
  const create_speech_recognition =  () => {
    console.log("Enabling subtitle")
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

    const recognition = new SpeechRecognition();
    speechRecognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.interimResults = true;

    recognition.addEventListener("result", (e)=>{
      let transcript = "";
      console.log(e.results);
      for(let i = e.resultIndex; i< e.results.length; i++){
          transcript += e.results[i][0].transcript;
      }
      setLocalSubtitle(transcript);
      console.log(transcript);
      send_msg_through_data_channel(create_msg_data("subtitle", transcript));
    });

    recognition.start();
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

  const hanldeScreenShareBtn = async () => {
    try {
      
      const sender = peerConnectionRef.current.
      getSenders()
      .find(sender => sender.track?.kind === "video");
      
      const capture_stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio:true,
      }); 
      setIsScreenShare(true);
      setLocalStream(capture_stream);
      
      const screen_tracks = capture_stream.getVideoTracks()[0];
      await sender.replaceTrack(screen_tracks);

      const camera_tracks = localStreamRef.current.getVideoTracks()[0];
      screen_tracks.addEventListener("ended", async (e) => {
        await sender.replaceTrack(camera_tracks);
        setIsScreenShare(false);
        setLocalStream(localStreamRef.current);
      });

    } catch (error) {
      console.log(error);
    }
  }
  const handleMsgSendBtn = () => {

    
    send_msg_through_data_channel(create_msg_data("chat", input_val));

    setMessage(prev => [...prev, {
      text : input_val,
      sender : "me",
    }]);
    setInputValue("");
  }
  return (
    <>
      <div className="grid gap-[2em] grid-cols-2">
      <div
      className="flex flex-col gap-1 items-center"
      >
        <Videos 
        isLocal={true} 
        stream={localStream}
        isScreenShare = {isScreenShare}
        />
        <p 
        className=""
        >{localSubtitle}</p>
      </div>
      <div
      className="flex flex-col gap-1 items-center"
      >
        <Videos
          isLocal={false} 
          stream={remoteStream} 
          isScreenShare = {isScreenShare}
          />
        <p
        className=""
        >{remoteSubtitle}</p>
      </div>

      </div>
      <div className="w-full flex gap-10 justify-center mt-10">
        <button 
          onClick={hanldeScreenShareBtn}
          className="border p-2 active:bg-slate-500"
        >Share screen</button>
        <button 
          onClick={create_speech_recognition}
          className="border p-2 active:bg-slate-500"
          >Enable Subtitle</button>
      </div>
      <div className="absolute bottom-15 w-full flex justify-center bg-inherit">

        {/* <div className="bg-black/70 text-white px-4 py-2 rounded-lg">
          {subtitle}
        </div> */}

      </div>
      <div 
        className="w-full max-w-xl mx-auto mt-10 border rounded-lg overflow-hidden text-[#1f1f1f]"
      >

        <div 
          id="message"
          className="h-80 overflow-y-auto bg-gray-100 p-4 flex flex-col gap-3"
        >

          {message.length ? (
            message.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.sender === "me"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`
                    max-w-[70%]
                    px-4 py-2 rounded-2xl shadow
                    break-words
                    ${
                      msg.sender === "me"
                        ? "bg-blue-500 text-white rounded-br-sm"
                        : "bg-white text-black rounded-bl-sm"
                    }
                  `}
                >
                  {msg.text}
                </div>

              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">
              No message yet
            </p>
          )}

        </div>

        <div className="flex items-center gap-2 p-3 border-t bg-white">

          <input
            type="text"
            placeholder="Enter your message"
            className="flex-1 border rounded-md px-3 py-2 outline-none"
            value={input_val}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={e => {
              if(e.key === "Enter") handleMsgSendBtn();
            }
            }
          />

          <button
            className="bg-blue-500 text-white px-4 py-2 rounded-md"
            onClick={handleMsgSendBtn}
          >
            Send
          </button>

        </div>
      </div>
    </>
  )
}