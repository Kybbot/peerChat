let APP_ID = "0d4cf4a779a84699b59d5897b5ee1c07";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let querySring = window.location.search;
let urlParams = new URLSearchParams(querySring);
let roomId = urlParams.get("room");

if (!roomId) {
	window.location = "lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
	iceServers:[
		{
			urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
		}
	]
}

const constraints = {
	video: {
		width: { min: 640,ideal: 1920,max: 1920},
		height: { min: 480,ideal: 1080,max: 1080}
	},
	audio: true
}

const user1Div = document.getElementById("user-1");
const user2Div = document.getElementById("user-2");
const cameraBtn = document.getElementById("camera-btn");
const micBtn = document.getElementById("mic-btn");
const leaveBtn = document.getElementById("leave-btn");

const init = async () => {
	client = await AgoraRTM.createInstance(APP_ID);
	await client.login({uid, token});

	channel = client.createChannel(roomId);
	await channel.join();

	channel.on("MemberJoined", handelUserJoined);

	channel.on("MemberLeft", handleUserLeft);

	client.on("MessageFromPeer", handleMessageFromPeer);

	localStream = await navigator.mediaDevices.getUserMedia(constraints);
	user1Div.srcObject = localStream;
}

const handleUserLeft = (MemberId) => {
	user2Div.style.display = 'none';
	user1Div.classList.remove("smallFrame");
}

const handleMessageFromPeer = async (message, MemberId) => {
	message = JSON.parse(message.text);

	if (message.type === "offer") {
		createAnswer(MemberId, message.offer);
	}

	if (message.type === "answer") {
		addAnswer(message.answer);
	}

	if (message.type === "candidate") {
		if (peerConnection) {
			peerConnection.addIceCandidate(message.candidate);
		}
	}
}

const handelUserJoined = async (MemberId) => {
	createOffer(MemberId);
}

const createPeerConnection = async (MemberId) => {
	peerConnection = new RTCPeerConnection(servers);

	remoteStream = new MediaStream();
	user2Div.srcObject = remoteStream;
	user2Div.style.display = 'block';

	user1Div.classList.add('smallFrame');

	if (!localStream) {
		localStream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true
		});
		user1Div.srcObject = localStream;
	}

	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	peerConnection.ontrack = (event) => {
		event.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
		});
	}

	peerConnection.onicecandidate = async (event) => {
		if (event.candidate) {
			client.sendMessageToPeer({text: JSON.stringify({
				"type": "candidate",
				"candidate": event.candidate
			})}, MemberId);
		}
	}
}

const createOffer = async (MemberId) => {
	await createPeerConnection(MemberId);

	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	client.sendMessageToPeer({text: JSON.stringify({
		"type": "offer",
		"offer": offer
	})}, MemberId);
}

const createAnswer = async (MemberId, offer) => {
	await createPeerConnection(MemberId);
	await peerConnection.setRemoteDescription(offer);

	let answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);

	client.sendMessageToPeer({text: JSON.stringify({
		"type": "answer",
		"answer": answer
	})}, MemberId);
}

const addAnswer = async (answer) => {
	if (!peerConnection.currentRemoteDescription) {
		peerConnection.setRemoteDescription(answer);
	}
}

const leaveChannel = async () => {
	await channel.leave();
	await client.logout();
}

const toggleCamera = async () => {
	let videoTrack = localStream.getTracks().find(track => track.kind === "video");

	if (videoTrack.enabled) {
		videoTrack.enabled = false;
		cameraBtn.style.backgroundColor = 'rgb(255, 80, 80)';
	} else {
		videoTrack.enabled = true;
		cameraBtn.style.backgroundColor = 'rgb(179, 102, 249, .9)';
	}
}

const toggleMic = async () => {
	let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

	if(audioTrack.enabled){
		audioTrack.enabled = false;
		micBtn.style.backgroundColor = 'rgb(255, 80, 80)';
	}else{
		audioTrack.enabled = true;
		micBtn.style.backgroundColor = 'rgb(179, 102, 249, .9)';
	}
}

window.addEventListener("beforeunload", leaveChannel);

cameraBtn.addEventListener("click", toggleCamera);
micBtn.addEventListener("click", toggleMic);

init();