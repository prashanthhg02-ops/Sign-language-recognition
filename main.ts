import './style.css'
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar"><a class="brand" href="/" aria-label="Signa home"><span class="brand-mark">S</span><span>signa</span></a><div class="topbar-meta"><span class="live-dot"></span><span id="model-status">model loading</span><span class="divider"></span><span>v0.4.1</span></div></header>
  <main>
    <section class="intro"><div><p class="eyebrow">AI / COMPUTER VISION</p><h1>Give your hands<br><em>a voice.</em></h1></div><p class="intro-copy">Real-time sign language recognition that turns movement into meaning. Start a session to translate hand shapes directly in your browser.</p></section>
    <section class="workspace"><div class="camera-card"><div class="camera-header"><span class="section-label"><i></i> LIVE CAPTURE</span><span id="fps">-- FPS</span></div><div class="camera-stage"><video id="camera" playsinline muted></video><canvas id="landmarks"></canvas><div class="camera-placeholder" id="placeholder"><div class="hand-icon">✋</div><p>Camera feed will appear here</p><small>Position your hand inside the frame</small></div><div class="scan-line"></div><span class="corner corner-tl"></span><span class="corner corner-tr"></span><span class="corner corner-bl"></span><span class="corner corner-br"></span></div><div class="camera-footer"><span class="privacy"><span class="lock">▣</span> Processed locally in your browser</span><button class="primary-btn" id="start-btn"><span>Start camera</span><b>↗</b></button></div></div>
      <aside class="result-panel"><div class="panel-heading"><span class="section-label">RECOGNITION</span><span class="confidence" id="confidence">—</span></div><div class="result-letter" id="result-letter">—</div><div class="result-word" id="result-word">Waiting for a gesture</div><div class="confidence-track"><span id="confidence-bar"></span></div><p class="result-hint" id="result-hint">Start the camera, then hold a clear hand shape in view.</p><div class="history-heading"><span>SESSION HISTORY</span><span id="history-count">0 SIGNS</span></div><ul class="history" id="history"><li class="empty-history">Your recognized signs will collect here.</li></ul><div class="supported"><span>SUPPORTED SHAPES</span><div class="shape-list"><span>✊ <b>Fist</b></span><span>☝ <b>Index</b></span><span>✌ <b>Peace</b></span><span>✋ <b>Open palm</b></span></div></div></aside></section>
    <footer><span>Built for clearer conversations</span><span>Signa <b>×</b> browser intelligence</span></footer>
  </main>`

const video = document.querySelector<HTMLVideoElement>('#camera')!
const canvas = document.querySelector<HTMLCanvasElement>('#landmarks')!
const ctx = canvas.getContext('2d')!
const startButton = document.querySelector<HTMLButtonElement>('#start-btn')!
const placeholder = document.querySelector<HTMLDivElement>('#placeholder')!
const status = document.querySelector<HTMLSpanElement>('#model-status')!
let handLandmarker: HandLandmarker | undefined
let lastVideoTime = -1
let lastLabel = ''
let lastSeen = 0
let history: string[] = []

async function loadModel() {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm')
  handLandmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 })
  status.textContent = 'model ready'
}

function classify(landmarks: NormalizedLandmark[]) {
  const tips = [8, 12, 16, 20], joints = [6, 10, 14, 18]
  const extended = tips.map((tip, index) => landmarks[tip].y < landmarks[joints[index]].y - 0.02)
  const count = extended.filter(Boolean).length
  if (count >= 4) return { label: '5', word: 'Open palm', confidence: 96 }
  if (count === 0) return { label: 'A', word: 'Fist', confidence: 91 }
  if (extended[0] && extended[1] && !extended[2] && !extended[3]) return { label: 'V', word: 'Peace sign', confidence: 89 }
  if (extended[0] && count === 1) return { label: '1', word: 'Index finger', confidence: 87 }
  return { label: '?', word: 'Keep holding', confidence: 62 }
}

function drawLandmarks(points: NormalizedLandmark[]) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#d7ff5f'; points.forEach((point) => { ctx.beginPath(); ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2); ctx.fill() }) }
function addHistory(label: string, word: string) { if (label === '?' || label === lastLabel) return; lastLabel = label; history = [`${label} · ${word}`, ...history].slice(0, 5); document.querySelector<HTMLUListElement>('#history')!.innerHTML = history.map((item) => `<li><span class="history-mark">${item.split(' · ')[0]}</span><span>${item.split(' · ')[1]}</span><time>now</time></li>`).join(''); document.querySelector('#history-count')!.textContent = `${history.length} SIGN${history.length === 1 ? '' : 'S'}` }

async function detect() { if (!handLandmarker || video.readyState < 2) return requestAnimationFrame(detect); if (video.currentTime !== lastVideoTime) { const result = handLandmarker.detectForVideo(video, performance.now()); lastVideoTime = video.currentTime; if (result.landmarks[0]) { drawLandmarks(result.landmarks[0]); const recognition = classify(result.landmarks[0]); document.querySelector('#result-letter')!.textContent = recognition.label; document.querySelector('#result-word')!.textContent = recognition.word; document.querySelector('#confidence')!.textContent = `${recognition.confidence}% MATCH`; document.querySelector<HTMLSpanElement>('#confidence-bar')!.style.width = `${recognition.confidence}%`; document.querySelector('#result-hint')!.textContent = recognition.label === '?' ? 'Try a fist, index, peace, or open palm.' : 'Gesture held clearly. Add another sign to build a phrase.'; if (performance.now() - lastSeen > 900) addHistory(recognition.label, recognition.word); lastSeen = performance.now() } else ctx.clearRect(0, 0, canvas.width, canvas.height) } requestAnimationFrame(detect) }

startButton.addEventListener('click', async () => { try { if (!handLandmarker) await loadModel(); const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false }); video.srcObject = stream; await video.play(); placeholder.hidden = true; startButton.querySelector('span')!.textContent = 'Camera active'; startButton.classList.add('active'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; detect() } catch (error) { status.textContent = 'camera permission needed'; document.querySelector('#result-hint')!.textContent = 'Camera access was unavailable. Check browser permissions and try again.'; console.error(error) } })
loadModel().catch(() => { status.textContent = 'model offline' })
