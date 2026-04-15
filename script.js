const matrixTable = document.getElementById("matrixTable");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectionInfo = document.getElementById("selectionInfo");
const startButton = document.getElementById("startButton");
const setupError = document.getElementById("setupError");
const timePerQuestionInput = document.getElementById("timePerQuestionInput");

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

  selectionInfo.textContent = `Zaznaczone dzialania: ${selectedSet.size}`;
}

function buildMatrix() {
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "corner";
  corner.textContent = "x";
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
      td.textContent = `${row}x${col}`;
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
}

function updateTimerText() {
  timerText.textContent = `Pozostaly czas: ${secondsLeft}s`;
}

function handleQuestionTimeout() {
  if (questionLocked) return;
  questionLocked = true;

  const q = activeQuestions[currentIndex];
  wrongQuestions.push(q);
  feedbackText.textContent = `Koniec czasu. Poprawna odpowiedz: ${q.a * q.b}`;
  feedbackText.className = "feedback wrong";
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
}

function renderCurrentQuestion() {
  const q = activeQuestions[currentIndex];
  questionLocked = false;
  roundTitle.textContent = `Runda ${roundNumber}`;
  progressText.textContent = `Pytanie ${currentIndex + 1} / ${activeQuestions.length}`;
  questionText.textContent = `${q.a} x ${q.b} = ?`;
  answerInput.value = "";
  feedbackText.textContent = "";
  feedbackText.className = "feedback";
  startQuestionCountdown();
  answerInput.focus();
}

function showSummary() {
  clearRunningTimers();
  const wrongCount = wrongQuestions.length;
  const total = activeQuestions.length;
  summarySection.classList.remove("hidden");
  quizSection.classList.add("hidden");

  if (wrongCount === 0) {
    summaryTitle.textContent = `Super! Wszystko poprawnie po ${roundNumber} rundach.`;
    summaryStats.textContent = `Idealny wynik: ${correctCount}/${total}.`;
    wrongListWrap.classList.add("hidden");
    nextRoundButton.classList.add("hidden");
  } else {
    summaryTitle.textContent = `Podsumowanie rundy ${roundNumber}`;
    summaryStats.textContent = `Wynik: ${correctCount}/${total}. Bledy: ${wrongCount}.`;
    wrongListWrap.classList.remove("hidden");
    nextRoundButton.classList.remove("hidden");
    wrongList.innerHTML = "";
    wrongQuestions.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = `${q.a} x ${q.b} = ${q.a * q.b}`;
      wrongList.appendChild(li);
    });
  }
}

function submitAnswer() {
  if (questionLocked) return;

  const raw = answerInput.value.trim();
  if (raw === "") {
    feedbackText.textContent = "Najpierw wpisz odpowiedz.";
    feedbackText.className = "feedback wrong";
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
  } else {
    wrongQuestions.push(q);
    feedbackText.textContent = `Zle. Poprawna odpowiedz: ${expected}`;
    feedbackText.className = "feedback wrong";
  }

  moveToNextStep();
}

function startFromSelection() {
  const parsedTime = Number(timePerQuestionInput.value);
  if (Number.isNaN(parsedTime) || parsedTime < 3 || parsedTime > 120) {
    setupError.textContent = "Ustaw czas od 3 do 120 sekund na jedno dzialanie.";
    return;
  }

  if (selectedSet.size === 0) {
    setupError.textContent = "Zaznacz przynajmniej jedno dzialanie w macierzy.";
    return;
  }

  setupError.textContent = "";
  secondsPerQuestion = parsedTime;
  roundNumber = 0;
  const questions = Array.from(selectedSet, parseKey);
  startRound(questions);
}

selectAllBtn.addEventListener("click", () => {
  selectedSet.clear();
  for (let row = 1; row <= 10; row += 1) {
    for (let col = 1; col <= 10; col += 1) {
      selectedSet.add(keyFor(row, col));
    }
  }
  paintSelection();
});

clearSelectionBtn.addEventListener("click", () => {
  selectedSet.clear();
  paintSelection();
});

startButton.addEventListener("click", startFromSelection);
submitButton.addEventListener("click", submitAnswer);
answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitAnswer();
});

nextRoundButton.addEventListener("click", () => startRound(wrongQuestions));
restartButton.addEventListener("click", () => {
  clearRunningTimers();
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
