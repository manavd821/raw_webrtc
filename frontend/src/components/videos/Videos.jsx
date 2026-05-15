import React, { useEffect, useRef } from 'react'

export default function Videos( {isLocal, stream, isScreenShare} ) {
    const videoRef = useRef(null);

    useEffect(() => {
        if(videoRef.current && stream){
          
            videoRef.current.srcObject = stream;
            videoRef.current.play()
              .then(() => {
                console.log("playing");
                console.log(videoRef.current.volume);
                console.log({isScreenShare});
              })
              .catch(err => {
                console.log("play blocked", err);
              });
              
            }
          }, [stream, isScreenShare]);
          
      useEffect(()=>{
        if(videoRef.current){
          videoRef.current.style.transform =
            isLocal && !isScreenShare
              ? "scaleX(-1)"
              : "scaleX(1)";
        }
      }, [isLocal, isScreenShare])
  return (
    <video
    autoPlay
    playsInline
    className={`w-full h-72 bg-white`}
    ref={videoRef}
    muted={isLocal}
    >
    </video>
  )
}
