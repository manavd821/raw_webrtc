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
              })
              .catch(err => {
                console.log("play blocked", err);
              });
        }
    }, [stream]);


  return (
    <video
    autoPlay
    playsInline
    className={`w-full h-72 bg-white ${isScreenShare ? "" : "scale-x-[-1]"}`}
    ref={videoRef}
    muted={isLocal}
    >
      
    </video>
  )
}
