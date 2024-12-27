import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001"); // Connect to signaling server

const CameraSync = () => {
  const laptopVideoRef = useRef(null);
  const mobileVideoRef = useRef(null);

  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    const startLaptopCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (laptopVideoRef.current) {
          laptopVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing laptop camera:", error);
      }
    };

    const initWebRTC = () => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // Free STUN server
        ],
      });

      pc.ontrack = (event) => {
        if (mobileVideoRef.current) {
          mobileVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("candidate", event.candidate);
        }
      };

      setPeerConnection(pc);
    };

    startLaptopCamera();
    initWebRTC();

    return () => {
      if (peerConnection) peerConnection.close();
    };
  }, []);

  useEffect(() => {
    if (!peerConnection) return;

    socket.on("offer", async (data) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (data) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    });

    socket.on("candidate", async (data) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });
  }, [peerConnection]);

  return (
    <div>
      <h2>Camera Sync</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <div>
          <h3>Laptop Camera</h3>
          <video ref={laptopVideoRef} autoPlay playsInline style={{ width: "300px", border: "1px solid #ccc" }} />
        </div>
        <div>
          <h3>Mobile Camera</h3>
          <video ref={mobileVideoRef} autoPlay playsInline style={{ width: "300px", border: "1px solid #ccc" }} />
        </div>
      </div>
    </div>
  );
};

export default CameraSync;
