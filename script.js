const matrixTable = document.getElementById("matrixTable");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectionInfo = document.getElementById("selectionInfo");
const startButton = document.getElementById("startButton");
const setupError = document.getElementById("setupError");
const timePerQuestionInput = document.getElementById("timePerQuestionInput");
const soundEnabledInput = document.getElementById("soundEnabledInput");

const quizSection = document.getElementById("quizSection");
const roundTitle = document.getElementById("roundTitle");
const progressText = document.getElementById("progressText");
const timerText = document.getElementById("timerText");
const questionText = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const submitButton = document.getElementById("submitButton");
const feedbackText = document.getElementById("feedbackText");

const summarySection = document.getElementById("summarySection");
const summaryTitle = document.getElementById("summaryTitle");
const summaryStats = document.getElementById("summaryStats");
const wrongListWrap = document.getElementById("wrongListWrap");
const wrongList = document.getElementById("wrongList");
const nextRoundButton = document.getElementById("nextRoundButton");
const restartButton = document.getElementById("restartButton");
const answerForm = document.getElementById("answerForm");

const selectedSet = new Set();

let roundNumber = 0;
let activeQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let wrongQuestions = [];
let secondsPerQuestion = 12;
let secondsLeft = 0;
let countdownInterval = null;
let transitionTimeout = null;
let questionLocked = false;
let autoSubmitTimeout = null;

let audioContext = null;
let polishVoice = null;

function isSoundOn() {
  return soundEnabledInput.checked;
}

function getAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioContext = new Ctx();
  }
  return audioContext;
}

function primeAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume();
  }
  if (window.speechSynthesis) {
    loadPolishVoice();
  }
}

function loadPolishVoice() {
  if (!window.speechSynthesis) return;
  const voices = speechSynthesis.getVoices();
  polishVoice =
    voices.find((v) => v.lang === "pl-PL") ||
    voices.find((v) => v.lang.startsWith("pl")) ||
    null;
}

if (window.speechSynthesis) {
  speechSynthesis.addEventListener("voiceschanged", loadPolishVoice);
  loadPolishVoice();
}

function playTone(frequency, durationSec, type = "sine", volume = 0.14) {
  if (!isSoundOn()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationSec);
}

function playSuccessTone() {
  playTone(523.25, 0.1);
  window.setTimeout(() => playTone(659.25, 0.14), 90);
}

function playErrorTone() {
  playTone(196, 0.22, "triangle", 0.16);
  window.setTimeout(() => playTone(147, 0.28, "triangle", 0.14), 140);
}

function playHintTone() {
  playTone(440, 0.08, "sine", 0.1);
}

function stopSpeech() {
  if (window.speechSynthesis) {
    speechSynthesis.cancel();
  }
}

function speakPolish(text) {
  if (!isSoundOn() || !text || !window.speechSynthesis) return;

  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pl-PL";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  if (polishVoice) utterance.voice = polishVoice;
  speechSynthesis.speak(utterance);
}

function playFeedback(toneKind, spokenText) {
  if (!isSoundOn()) return;

  primeAudio();

  if (toneKind === "correct") playSuccessTone();
  else if (toneKind === "wrong" || toneKind === "timeout") playErrorTone();
  else if (toneKind === "hint") playHintTone();

  if (spokenText) {
    const delay = toneKind === "correct" ? 60 : 180;
    window.setTimeout(() => speakPolish(spokenText), delay);
  }
}

function multiplyLabel(a, b) {
  return `${a} × ${b}`;
}

function getCurrentExpectedAnswer() {
  const q = activeQuestions[currentIndex];
  return q.a * q.b;
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function clearAutoSubmitTimeout() {
  if (autoSubmitTimeout) {
    window.clearTimeout(autoSubmitTimeout);
    autoSubmitTimeout = null;
  }
}

function focusAnswerInput() {
  window.setTimeout(() => {
    answerInput.focus({ preventScroll: false });
    answerInput.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 120);
}

function maybeAutoSubmitAnswer() {
  if (questionLocked) return;

  const raw = digitsOnly(answerInput.value);
  if (!raw) return;

  const expected = getCurrentExpectedAnswer();
  const expectedLen = String(expected).length;
  if (raw.length < expectedLen) return;

  clearAutoSubmitTimeout();
  autoSubmitTimeout = window.setTimeout(() => {
    autoSubmitTimeout = null;
    submitAnswer();
  }, 150);
}

function handleAnswerInput() {
  const cleaned = digitsOnly(answerInput.value);
  if (answerInput.value !== cleaned) {
    answerInput.value = cleaned;
  }
  maybeAutoSubmitAnswer();
}

function keyFor(a, b) {
  return `${a}-${b}`;
}

function parseKey(key) {
  const [a, b] = key.split("-").map(Number);
  return { a, b };
}

function getCell(a, b) {
  return document.querySelector(`[data-a="${a}"][data-b="${b}"]`);
}

function toggleCell(a, b) {
  const key = keyFor(a, b);
  if (selectedSet.has(key)) {
    selectedSet.delete(key);
  } else {
    selectedSet.add(key);
  }
  paintSelection();
}

function setRow(row, value) {
  for (let col = 1; col <= 10; col += 1) {
    const key = keyFor(row, col);
    if (value) selectedSet.add(key);
    else selectedSet.delete(key);
  }
}

function setColumn(col, value) {
  for (let row = 1; row <= 10; row += 1) {
    const key = keyFor(row, col);
    if (value) selectedSet.add(key);
    else selectedSet.delete(key);
  }
}

function rowFullySelected(row) {
  for (let col = 1; col <= 10; col += 1) {
    if (!selectedSet.has(keyFor(row, col))) return false;
  }
  return true;
}

function columnFullySelected(col) {
  for (let row = 1; row <= 10; row += 1) {
    if (!selectedSet.has(keyFor(row, col))) return false;
  }
  return true;
}

function paintSelection() {
  for (let row = 1; row <= 10; row += 1) {
    for (let col = 1; col <= 10; col += 1) {
      const cell = getCell(row, col);
      const isSelected = selectedSet.has(keyFor(row, col));
      cell.classList.toggle("selected", isSelected);
    }
  }

  for (let row = 1; row <= 10; row += 1) {
    const header = document.querySelector(`[data-row-header="${row}"]`);
    header.classList.toggle("selected", rowFullySelected(row));
  }

  for (let col = 1; col <= 10; col += 1) {
    const header = document.querySelector(`[data-col-header="${col}"]`);
    header.classList.toggle("selected", columnFullySelected(col));
  }

  selectionInfo.textContent = `Zaznaczone działania: ${selectedSet.size}`;
}

function buildMatrix() {
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "corner";
  corner.textContent = "×";
  headerRow.appendChild(corner);

  for (let col = 1; col <= 10; col += 1) {
    const colHeader = document.createElement("th");
    colHeader.className = "col-header";
    colHeader.dataset.colHeader = String(col);
    colHeader.textContent = String(col);
    colHeader.addEventListener("click", () => {
      setColumn(col, !columnFullySelected(col));
      paintSelection();
    });
    headerRow.appendChild(colHeader);
  }
  matrixTable.appendChild(headerRow);

  for (let row = 1; row <= 10; row += 1) {
    const tr = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.className = "row-header";
    rowHeader.dataset.rowHeader = String(row);
    rowHeader.textContent = String(row);
    rowHeader.addEventListener("click", () => {
      setRow(row, !rowFullySelected(row));
      paintSelection();
    });
    tr.appendChild(rowHeader);

    for (let col = 1; col <= 10; col += 1) {
      const td = document.createElement("td");
      td.className = "cell";
      td.dataset.a = String(row);
      td.dataset.b = String(col);
      td.textContent = `${row}×${col}`;
      td.addEventListener("click", () => toggleCell(row, col));
      tr.appendChild(td);
    }

    matrixTable.appendChild(tr);
  }

  paintSelection();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function clearRunningTimers() {
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (transitionTimeout) {
    window.clearTimeout(transitionTimeout);
    transitionTimeout = null;
  }
  clearAutoSubmitTimeout();
}

function updateTimerText() {
  timerText.textContent = `Pozostały czas: ${secondsLeft} s`;
}

function handleQuestionTimeout() {
  if (questionLocked) return;
  questionLocked = true;

  const q = activeQuestions[currentIndex];
  const answer = q.a * q.b;
  wrongQuestions.push(q);
  feedbackText.textContent = `Koniec czasu. Poprawna odpowiedź: ${answer}`;
  feedbackText.className = "feedback wrong";
  playFeedback(
    "timeout",
    `Koniec czasu. Poprawna odpowiedź to ${answer}.`
  );
  moveToNextStep();
}

function startQuestionCountdown() {
  secondsLeft = secondsPerQuestion;
  updateTimerText();
  if (countdownInterval) window.clearInterval(countdownInterval);
  countdownInterval = window.setInterval(() => {
    secondsLeft -= 1;
    updateTimerText();
    if (secondsLeft <= 0) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
      handleQuestionTimeout();
    }
  }, 1000);
}

function moveToNextStep() {
  currentIndex += 1;
  transitionTimeout = window.setTimeout(() => {
    if (currentIndex < activeQuestions.length) {
      renderCurrentQuestion();
    } else {
      showSummary();
    }
  }, 600);
}

function startRound(questions) {
  clearRunningTimers();
  stopSpeech();
  roundNumber += 1;
  activeQuestions = [...questions];
  shuffle(activeQuestions);
  currentIndex = 0;
  correctCount = 0;
  wrongQuestions = [];
  questionLocked = false;
  feedbackText.textContent = "";
  feedbackText.className = "feedback";
  summarySection.classList.add("hidden");
  quizSection.classList.remove("hidden");
  renderCurrentQuestion();

  if (roundNumber === 1) {
    playFeedback(null, "Zaczynamy. Powodzenia!");
  } else {
    playFeedback(null, "Kolejna runda.");
  }
}

function renderCurrentQuestion() {
  const q = activeQuestions[currentIndex];
  questionLocked = false;
  roundTitle.textContent = `Runda ${roundNumber}`;
  progressText.textContent = `Pytanie ${currentIndex + 1} / ${activeQuestions.length}`;
  questionText.textContent = `${multiplyLabel(q.a, q.b)} = ?`;
  answerInput.value = "";
  answerInput.maxLength = String(q.a * q.b).length;
  feedbackText.textContent = "";
  feedbackText.className = "feedback";
  startQuestionCountdown();
  focusAnswerInput();
}

function showSummary() {
  clearRunningTimers();
  const wrongCount = wrongQuestions.length;
  const total = activeQuestions.length;
  summarySection.classList.remove("hidden");
  quizSection.classList.add("hidden");

  if (wrongCount === 0) {
    summaryTitle.textContent = `Świetnie! Wszystko poprawnie po ${roundNumber} rundach.`;
    summaryStats.textContent = `Idealny wynik: ${correctCount}/${total}.`;
    wrongListWrap.classList.add("hidden");
    nextRoundButton.classList.add("hidden");
    playFeedback(
      "correct",
      `Świetnie! Wszystkie odpowiedzi poprawne. Wynik ${correctCount} na ${total}.`
    );
  } else {
    summaryTitle.textContent = `Podsumowanie rundy ${roundNumber}`;
    summaryStats.textContent = `Wynik: ${correctCount}/${total}. Błędy: ${wrongCount}.`;
    wrongListWrap.classList.remove("hidden");
    nextRoundButton.classList.remove("hidden");
    wrongList.innerHTML = "";
    wrongQuestions.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = `${multiplyLabel(q.a, q.b)} = ${q.a * q.b}`;
      wrongList.appendChild(li);
    });
    const bledySlowo = wrongCount === 1 ? "błąd" : wrongCount < 5 ? "błędy" : "błędów";
    playFeedback(
      null,
      `Koniec rundy. Masz ${wrongCount} ${bledySlowo}. Powtórz je w następnej rundzie.`
    );
  }
}

function submitAnswer() {
  if (questionLocked) return;
  clearAutoSubmitTimeout();

  const raw = digitsOnly(answerInput.value.trim());
  if (raw === "") {
    feedbackText.textContent = "Najpierw wpisz odpowiedź.";
    feedbackText.className = "feedback wrong";
    playFeedback("hint", "Najpierw wpisz odpowiedź.");
    return;
  }

  questionLocked = true;
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }

  const q = activeQuestions[currentIndex];
  const expected = q.a * q.b;
  const isCorrect = Number(raw) === expected;

  if (isCorrect) {
    correctCount += 1;
    feedbackText.textContent = "Dobrze!";
    feedbackText.className = "feedback correct";
    playFeedback("correct", "Dobrze!");
  } else {
    wrongQuestions.push(q);
    feedbackText.textContent = `Źle. Poprawna odpowiedź: ${expected}`;
    feedbackText.className = "feedback wrong";
    playFeedback("wrong", `Źle. Poprawna odpowiedź to ${expected}.`);
  }

  moveToNextStep();
}

function startFromSelection() {
  primeAudio();

  const parsedTime = Number(timePerQuestionInput.value);
  if (Number.isNaN(parsedTime) || parsedTime < 3 || parsedTime > 120) {
    setupError.textContent = "Ustaw czas od 3 do 120 sekund na jedno działanie.";
    playFeedback("hint", "Ustaw czas od 3 do 120 sekund na jedno działanie.");
    return;
  }

  if (selectedSet.size === 0) {
    setupError.textContent = "Zaznacz przynajmniej jedno działanie w macierzy.";
    playFeedback("hint", "Zaznacz przynajmniej jedno działanie w macierzy.");
    return;
  }

  setupError.textContent = "";
  secondsPerQuestion = parsedTime;
  roundNumber = 0;
  const questions = Array.from(selectedSet, parseKey);
  startRound(questions);
}

selectAllBtn.addEventListener("click", () => {
  primeAudio();
  selectedSet.clear();
  for (let row = 1; row <= 10; row += 1) {
    for (let col = 1; col <= 10; col += 1) {
      selectedSet.add(keyFor(row, col));
    }
  }
  paintSelection();
});

clearSelectionBtn.addEventListener("click", () => {
  primeAudio();
  selectedSet.clear();
  paintSelection();
});

startButton.addEventListener("click", startFromSelection);
answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAnswer();
});
answerInput.addEventListener("input", handleAnswerInput);

soundEnabledInput.addEventListener("change", () => {
  if (!soundEnabledInput.checked) {
    stopSpeech();
  }
});

nextRoundButton.addEventListener("click", () => {
  primeAudio();
  startRound(wrongQuestions);
});

restartButton.addEventListener("click", () => {
  clearRunningTimers();
  stopSpeech();
  roundNumber = 0;
  activeQuestions = [];
  currentIndex = 0;
  correctCount = 0;
  wrongQuestions = [];
  questionLocked = false;
  timerText.textContent = "";
  quizSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  feedbackText.textContent = "";
  setupError.textContent = "";
});

buildMatrix();
