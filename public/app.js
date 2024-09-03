const localVideo = document.createElement('video');
localVideo.autoplay = true;
const videosGrid = document.getElementById('videos-grid');
const rtcPeerConnections = {};
const iceServers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
let myId;

navigator.mediaDevices
  .getUserMedia({ audio: false, video: true })
  .then((stream) => {
    /* use the stream */
    localVideo.srcObject = stream;
    addVideoToGrid(localVideo);
    startSignaling();
  })
  .catch((err) => {
    /* handle the error */
    console.error("An error occurred:", err);
  });

function startSignaling() {
  const socket = io();

  socket.on("connect", () => {
    console.log("My id is:", socket.id);
    myId = socket.id;
  });

  socket.on("event", (evt) => {
    switch (evt.type) {
      case "join":
        console.log(evt.from + " has joined");
        rtcPeerConnections[evt.from] = createRTCPeerConnection(evt.from);
        rtcPeerConnections[evt.from]
          .createOffer()
          .then((sdp) => onOfferAnswer("offer", sdp, evt.from));
        break;
      case "offer":
        console.log(evt.from + " has sent an offer:", evt.sdp);
        rtcPeerConnections[evt.from] = createRTCPeerConnection(evt.from);
        rtcPeerConnections[evt.from].setRemoteDescription(
          new RTCSessionDescription(evt.sdp)
        );
        rtcPeerConnections[evt.from]
          .createAnswer()
          .then((sdp) => onOfferAnswer("answer", sdp, evt.from));
        break;
      case "answer":
        console.log(evt.from + " has sent an answer:", evt.sdp);
        rtcPeerConnections[evt.from].setRemoteDescription(
          new RTCSessionDescription(evt.sdp)
        );
        break;
      case "candidate":
        console.log(evt.from, "sent a candidate:", evt.candidate);
        rtcPeerConnections[evt.from].addIceCandidate(
          new RTCIceCandidate({
            sdpMLineIndex: evt.label,
            candidate: evt.candidate,
          })
        );
        break;
      case "bye":
        console.log(evt.from + " has left");
        const videoElement = document.getElementById("remote_" + evt.from);
        videoElement.pause();
        videoElement.removeAttribute("srcObject"); // empty source
        videoElement.load();
        videoElement.remove();
        styleVideos();

        rtcPeerConnections[evt.from].close();
        delete rtcPeerConnections[evt.from];
        break;
    }
  });

  function sendSignaling(data) {
    socket.emit("event", data);
  }

  function createRTCPeerConnection(remoteUser) {
    const rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = (e) => onIceCandidate(e, remoteUser);
    rtcPeerConnection.ontrack = (e) => onAddTrack(e, remoteUser);
    rtcPeerConnection.addTrack(localVideo.srcObject.getVideoTracks()[0]);

    return rtcPeerConnection;
  }

  function onOfferAnswer(type, sdp, to) {
    rtcPeerConnections[to].setLocalDescription(sdp);
    console.log("sending " + type + " to:", to);
    sendSignaling({
      to: to,
      from: myId,
      type: type,
      sdp: sdp,
    });
  }

  function onIceCandidate(event, to) {
    if (event.candidate) {
      console.log("sending ice candidate to:", to);
      sendSignaling({
        type: "candidate",
        from: myId,
        to: to,
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      });
    }
  }

  function onAddTrack(event, from) {
    console.log("got video from", from);
    const remoteVideo = document.createElement("video");
    remoteVideo.id = "remote_" + from;
    remoteVideo.autoplay = true;
    remoteVideo.srcObject = new MediaStream([event.track]);
    addVideoToGrid(remoteVideo);

    styleVideos();
  }
}

function addVideoToGrid(videoElement) {
  const videoContainer = document.createElement('div');
  videoContainer.classList.add('video-container');
  videoContainer.appendChild(videoElement);
  videosGrid.appendChild(videoContainer);
  styleVideos();
}

function styleVideos() {
  const videos = Array.from(videosGrid.getElementsByTagName('video'));

  if (videos.length === 1) {
    videos[0].style.gridRow = '1 / span 2';
    videos[0].style.gridColumn = '1 / span 2';
  } else if (videos.length <= 3 && videos.length > 1) {
    videos.forEach((video, index) => {
      video.style.gridRow = `span ${Math.ceil(videos.length / 2)}`;
      video.style.gridColumn = `${index % Math.ceil(videos.length / 2)} / span 1`;
    });
  } else if (videos.length >= 4) {
    videos.forEach((video, index) => {
      video.style.gridRow = `auto`;
      video.style.gridColumn = `auto`;
    });

    const rows = Math.ceil(videos.length / 4);
    videosGrid.style.gridTemplateColumns = `repeat(4, 1fr)`;
    videosGrid.style.gridAutoRows = `${100 / rows}%`;
  }
}
