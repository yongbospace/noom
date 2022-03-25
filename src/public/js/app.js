const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let nickname;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.lable) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstrains = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstrains : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmuted";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Cam Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Cam On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");
const roomTitle = document.getElementById("roomTitle");
const myNickname = document.getElementById("myNickname");
const peerNickname = document.getElementById("peerNickname");
const chatList = document.querySelector("#chatList ul");
const chatForm = document.querySelector("#chatInput form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handelWelcomeSubmit(event) {
  event.preventDefault();
  const roomInput = document.getElementById("roomInput");
  const nickInput = document.getElementById("nickInput");
  await initCall();
  socket.emit("updateNickname", nickInput.value);
  socket.emit("join_room", roomInput.value);
  roomName = roomInput.value;
  roomInput.value = "";
  roomTitle.innerText = `Room: ${roomName}`;
  myNickname.innerText = nickInput.value;
  socket.on("peerNickname", (nickname) => handlePeerNick(nickname));
}

async function handlePeerNick(nickname) {
  peerNickname.innerText = await nickname;
}

welcomeForm.addEventListener("submit", handelWelcomeSubmit);

socket.on("dismiss", () => {
  alert("This room is already full(2/2), you will return to the Home.");
  window.location.reload(true);
});

// Socket Code
//  A user message
socket.on("welcome", async (nickname) => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) =>
    handleGetChat(nickname, event)
  );
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});
//  B user message
socket.on("offer", async (offer, nickname) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      handleGetChat(nickname, event)
    );
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

socket.on("bye", (nickname) => {
  const li = document.createElement("li");
  li.innerText = `${nickname} left`;
  chatList.appendChild(li);
  setTimeout(() => window.location.reload(true), 2000);
});

// RTC Code

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("track", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.streams[0];
}

// Chat
function handleGetChat(nickname, event) {
  const li = document.createElement("li");
  li.innerText = `${nickname}: ${event.data}`;
  chatList.appendChild(li);
}

function handleSendChat(event) {
  event.preventDefault();
  const input = chatForm.querySelector("input");
  myDataChannel.send(input.value);
  const li = document.createElement("li");
  li.innerText = `${myNickname.innerText} : ${input.value}`;
  chatList.appendChild(li);
  input.value = "";
}

chatForm.addEventListener("submit", handleSendChat);
