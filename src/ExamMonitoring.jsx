import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

const ExamMonitoring = () => {
  const videoRef = useRef(null); // Local webcam
  const ipCamImgRef = useRef(null); // IP webcam feed using <img>
  const canvasRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [noFaceCount, setNoFaceCount] = useState(0);
  const [multiFaceCount, setMultiFaceCount] = useState(0);
  const [model, setModel] = useState(null);
  const [borderColor, setBorderColor] = useState('green'); // Dynamic border color
  const [isTabActive, setIsTabActive] = useState(true); // Track tab activity
  const [isLoudNoise, setIsLoudNoise] = useState(false); // Track loud noise detection

  // IP Webcam URL (Replace with your own IP Webcam address)
  const ipCamUrl = 'http://100.78.14.172:8080/'; // Change <IP_ADDRESS> to the actual IP address of the device running the IP webcam

  useEffect(() => {
    // Load the BlazeFace model
    const loadModel = async () => {
      const loadedModel = await blazeface.load();
      setModel(loadedModel);
      console.log('BlazeFace model loaded');
    };
    loadModel();
  }, []);

  useEffect(() => {
    // Start the local video stream
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      } catch (error) {
        console.error('Error accessing camera:', error);
        setLogs((prevLogs) => [...prevLogs, 'Error accessing camera']);
      }
    };
    startVideo();
  }, []);

  // Start the IP webcam stream
  useEffect(() => {
    const ipCamStream = ipCamImgRef.current;
    if (ipCamStream) {
      ipCamStream.src = ipCamUrl;
      // No need to call play() for <img> tag, it will automatically display the MJPEG stream
    }
  }, []);

  const detectFaces = async () => {
    if (!model || !videoRef.current || !ipCamImgRef.current) return;

    const video = videoRef.current;
    const ipCamImg = ipCamImgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth + ipCamImg.width; // Combine both video widths
    canvas.height = Math.max(video.videoHeight, ipCamImg.height); // Set height to max of both videos

    // Clear previous canvas drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the local webcam video
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Draw the IP webcam feed next to the local webcam
    ctx.drawImage(ipCamImg, video.videoWidth, 0, ipCamImg.width, ipCamImg.height);

    // Face detection for local webcam
    const predictions = await model.estimateFaces(video, false); // Detect faces in local webcam feed
    processFaceDetection(predictions, ctx, 0); // 0 for local webcam

    // Face detection for IP webcam
    const ipCamPredictions = await model.estimateFaces(ipCamImg, false); // Detect faces in IP webcam feed
    processFaceDetection(ipCamPredictions, ctx, video.videoWidth); // video.videoWidth for IP webcam (offset)
  };

  const processFaceDetection = (predictions, ctx, offsetX) => {
    if (predictions.length === 0) {
      // No faces detected
      setNoFaceCount((prevCount) => {
        const newCount = prevCount + 1;
        setLogs((prevLogs) => [
          ...prevLogs,
          `No face detected at ${new Date().toLocaleTimeString()}`,
        ]);
        return newCount;
      });
      setBorderColor('red');
    } else if (predictions.length > 1) {
      // Multiple faces detected
      setMultiFaceCount((prevCount) => {
        const newCount = prevCount + 1;
        setLogs((prevLogs) => [
          ...prevLogs,
          `Multiple faces detected at ${new Date().toLocaleTimeString()}`,
        ]);
        return newCount;
      });
      setBorderColor('red');

      // Draw bounding boxes for multiple faces
      predictions.forEach((prediction) => {
        const [x, y, width, height] = prediction.box;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + offsetX, y, width, height); // Adjust x for IP webcam feed
      });
    } else {
      // Single face detected
      const [x, y, width, height] = predictions[0].box;
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + offsetX, y, width, height); // Adjust x for IP webcam feed
      setBorderColor('green');
    }
  };

  // Monitor tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsTabActive(true);
      } else {
        setIsTabActive(false);
        setLogs((prevLogs) => [
          ...prevLogs,
          `Tab switched at ${new Date().toLocaleTimeString()}`,
        ]);
        setBorderColor('red'); // Mark malpractice
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Detect loud noises
  useEffect(() => {
    const startAudioDetection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 512;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let noiseDetectionTimeout = false;

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

          if (volume > 24) { // Adjust threshold as needed
            if (!isLoudNoise && !noiseDetectionTimeout) {
              setLogs((prevLogs) => [
                ...prevLogs,
                `Loud noise detected at ${new Date().toLocaleTimeString()}`,
              ]);
              setIsLoudNoise(true);
              setBorderColor('red'); // Mark malpractice

              // Start the sleep (disable further loud noise detection for 1 second)
              noiseDetectionTimeout = true;
              setTimeout(() => {
                noiseDetectionTimeout = false;
              }, 1000); // Sleep for 1 second
            }
          } else {
            setIsLoudNoise(false);
          }
        };

        const interval = setInterval(checkVolume, 500);
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };
    startAudioDetection();
  }, []);

  useEffect(() => {
    // Run face detection every 2 seconds
    const interval = setInterval(detectFaces, 2000);
    return () => clearInterval(interval);
  }, [model, isTabActive, isLoudNoise]);

  return (
    <div>
      <h1>Exam Monitoring System</h1>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <div style={{ position: 'relative', border: `5px solid ${borderColor}`, borderRadius: '10px' }}>
          <h3>Local Webcam</h3>
          <video ref={videoRef} style={{ width: '320px', height: '240px' }} />
        </div>
        <div style={{ position: 'relative', border: `5px solid ${borderColor}`, borderRadius: '10px', marginLeft: '20px' }}>
          <h3>IP Webcam Feed</h3>
          {/* <img ref={ipCamImgRef} style={{ width: '320px', height: '240px' }} alt="IP Webcam Feed" /> */}
          <video ref={ipCamImgRef} style={{ width: '320px', height: '240px' }} />
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div>
        <h2>Logs</h2>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
        <div>
          <p>No Face Detected Count: {noFaceCount}</p>
          <p>Multiple Faces Detected Count: {multiFaceCount}</p>
        </div>
      </div>
    </div>
  );
};

export default ExamMonitoring;
