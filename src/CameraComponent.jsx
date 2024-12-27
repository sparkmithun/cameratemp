import React, { useRef, useEffect } from "react";

const CameraComponent = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        // Request access to the camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }, // Use "environment" for the back camera
        });

        // Set the video source to the stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing the camera:", error);
        alert("Unable to access the camera. Please check your permissions.");
      }
    };

    startCamera();

    // Cleanup function to stop the camera
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Mobile Camera Feed</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", height: "auto", border: "1px solid #ccc" }}
      />
    </div>
  );
};

export default CameraComponent;
