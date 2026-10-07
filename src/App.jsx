import { useEffect, useMemo, useRef, useState } from "react";
import { BRAILLE, PHRASES, WORDS, dotsForLetter } from "./data/braille";
import { speak, stopSpeaking } from "./services/speech";
import {
  connectSerial,
  disconnectSerial,
  isConnected,
  sendCommand,
  serialSupported,
} from "./services/serial";

const MODES = {
  home: "Início",
  letters: "Aprender letras",
  words: "Praticar palavras",
  phrases: "Praticar frases",
  free: "Digitação livre",
  progress: "Meu progresso",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nextRandom(list, current = "") {
  if (list.length <= 1) return list[0] || "";
  let next = current;
  while (next === current) next = list[Math.floor(Math.random() * list.length)];
  return next;
}

function BrailleCell({ letter, size = "large" }) {
  const active = dotsForLetter(letter);
  const dots = [1, 4, 2, 5, 3, 6];
  const label = active.length
    ? `Letra ${letter}. Pontos Braille ${active.join(", ")}.`
    : `Nenhum ponto Braille ativo.`;

  return (
    <div className={`braille-cell braille-cell--${size}`} role="img" aria-label={label}>
      {dots.map((dot) => (
        <span
          key={dot}
          className={active.includes(dot) ? "braille-dot is-active" : "braille-dot"}
          aria-hidden="true"
        >
          <span className="dot-number">{dot}</span>
        </span>
      ))}
    </div>
  );
}

function HeaderButton({ children, ...props }) {
  return (
    <button className="utility-button" type="button" {...props}>
      {children}
    </button>
  );
}

function App() {
  const [mode, setMode] = useState("home");
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [target, setTarget] = useState(WORDS[0]);
  const [answer, setAnswer] = useState("");
  const [freeText, setFreeText] = useState("");
  const [feedback, setFeedback] = useState(
    "Bem-vindo ao Braille UP! Escolha uma atividade para começar."
  );
  const [speakKeys, setSpeakKeys] = useState(true);
  const [connected, setConnected] = useState(false);
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem("brailleUpHighContrast") === "true"
  );
  const [fontScale, setFontScale] = useState(
    () => Number(localStorage.getItem("brailleUpFontScale") || 1)
  );
  const [attempts, setAttempts] = useState(
    () => Number(localStorage.getItem("brailleUpAttempts") || 0)
  );
  const [correct, setCorrect] = useState(
    () => Number(localStorage.getItem("brailleUpCorrect") || 0)
  );
  const answerRef = useRef(null);

  const points = useMemo(() => dotsForLetter(selectedLetter), [selectedLetter]);
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

  useEffect(() => {
    localStorage.setItem("brailleUpAttempts", String(attempts));
    localStorage.setItem("brailleUpCorrect", String(correct));
  }, [attempts, correct]);

  useEffect(() => {
    localStorage.setItem("brailleUpHighContrast", String(highContrast));
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [highContrast]);

  useEffect(() => {
    const safeScale = Math.max(0.9, Math.min(1.35, fontScale));
    document.documentElement.style.setProperty("--font-scale", safeScale);
    localStorage.setItem("brailleUpFontScale", String(safeScale));
  }, [fontScale]);

  useEffect(() => {
    if ((mode === "words" || mode === "phrases") && answerRef.current) {
      answerRef.current.focus();
    }
  }, [mode, target]);

  function goTo(nextMode, message) {
    setMode(nextMode);
    setAnswer("");
    stopSpeaking();
    if (message) setFeedback(message);
    window.setTimeout(() => document.getElementById("main-content")?.focus(), 0);
  }

  async function announceLetter(letter) {
    const dots = dotsForLetter(letter);
    setSelectedLetter(letter);
    const message = `Letra ${letter}. Pontos ${dots.join(", ")}.`;
    setFeedback(message);
    speak(`Letra ${letter}. Pontos ${dots.join(" e ")}.`);
    try {
      await sendCommand(`CHAR:${letter}`);
    } catch {
      setFeedback(`${message} A célula física não recebeu o comando.`);
    }
  }

  function startPractice(type) {
    const list = type === "words" ? WORDS : PHRASES;
    const next = nextRandom(list, target);
    setMode(type);
    setTarget(next);
    setAnswer("");
    const label = type === "words" ? "palavra" : "frase curta";
    const message = `Desafio iniciado. Ouça e digite a ${label}.`;
    setFeedback(message);
    speak(`Digite a ${label}: ${next}`);
  }

  function handleKeyDown(event) {
    if (!speakKeys) return;

    if (event.key.length === 1 && /[a-zA-ZÀ-ÿ0-9]/.test(event.key)) {
      speak(event.key.toUpperCase(), { interrupt: true, rate: 0.82 });
    } else if (event.key === "Backspace") {
      speak("apagou", { interrupt: true, rate: 0.82 });
    } else if (event.key === " ") {
      speak("espaço", { interrupt: true, rate: 0.82 });
    }
  }

  function hearChallenge() {
    const typeLabel = mode === "words" ? "palavra" : "frase";
    setFeedback(`Repetindo a ${typeLabel}: ${target}.`);
    speak(`Digite: ${target}`);
  }

  function checkAnswer(event) {
    event.preventDefault();
    if (!answer.trim()) {
      const msg = "Digite uma resposta antes de verificar.";
      setFeedback(msg);
      speak(msg);
      return;
    }

    const isCorrectAnswer = normalizeText(answer) === normalizeText(target);
    setAttempts((n) => n + 1);

    if (isCorrectAnswer) {
      setCorrect((n) => n + 1);
      const msg = `Muito bem! Você escreveu ${target} corretamente.`;
      setFeedback(msg);
      speak(msg);
    } else {
      const msg = "Ainda não está igual. Você pode ouvir novamente e tentar outra vez.";
      setFeedback(msg);
      speak(msg);
    }
  }

  function nextChallenge() {
    const list = mode === "words" ? WORDS : PHRASES;
    const next = nextRandom(list, target);
    setTarget(next);
    setAnswer("");
    setFeedback("Novo desafio preparado. Ouça com atenção.");
    speak(`Novo desafio. Digite: ${next}`);
  }

  async function toggleSerial() {
    try {
      if (isConnected()) {
        await disconnectSerial();
        setConnected(false);
        const msg = "Célula Braille desconectada.";
        setFeedback(msg);
        speak(msg);
      } else {
        await connectSerial();
        setConnected(true);
        const msg = "Célula Braille conectada com sucesso.";
        setFeedback(msg);
        speak(msg);
      }
    } catch (error) {
      setConnected(false);
      setFeedback(`Não foi possível conectar a célula Braille. ${error.message}`);
    }
  }

  function resetProgress() {
    const ok = window.confirm(
      "Deseja zerar todas as tentativas e acertos registrados neste computador?"
    );
    if (!ok) return;
    setAttempts(0);
    setCorrect(0);
    setFeedback("Progresso zerado.");
    speak("Progresso zerado.");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo principal
      </a>

      <header className="site-header">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">
            <span className="mini-dot"></span>
            <span className="mini-dot"></span>
            <span className="mini-dot"></span>
            <span className="mini-dot"></span>
            <span className="mini-dot"></span>
            <span className="mini-dot"></span>
          </div>
          <div>
            <p className="eyebrow">Tecnologia assistiva para aprendizagem</p>
            <h1>BRAILLE UP!</h1>
            <p className="tagline">Tocar. Ouvir. Aprender. Digitar.</p>
          </div>
        </div>

        <div className="header-tools" aria-label="Ferramentas de acessibilidade">
          <HeaderButton
            aria-label="Diminuir tamanho das letras"
            onClick={() => setFontScale((v) => Math.max(0.9, Number((v - 0.1).toFixed(2))))}
          >
            A−
          </HeaderButton>
          <HeaderButton
            aria-label="Aumentar tamanho das letras"
            onClick={() => setFontScale((v) => Math.min(1.35, Number((v + 0.1).toFixed(2))))}
          >
            A+
          </HeaderButton>
          <HeaderButton
            aria-pressed={highContrast}
            onClick={() => setHighContrast((v) => !v)}
          >
            {highContrast ? "Contraste normal" : "Alto contraste"}
          </HeaderButton>
          <HeaderButton onClick={() => speak(feedback)}>Ouvir mensagem</HeaderButton>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar" aria-label="Menu principal">
          <button
            className={mode === "home" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "home" ? "page" : undefined}
            onClick={() => goTo("home", "Você voltou ao início.")}
          >
            <span aria-hidden="true">⌂</span>
            Início
          </button>
          <button
            className={mode === "letters" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "letters" ? "page" : undefined}
            onClick={() => goTo("letters", "Modo aprender letras. Escolha uma letra.")}
          >
            <span aria-hidden="true">A</span>
            Aprender letras
          </button>
          <button
            className={mode === "words" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "words" ? "page" : undefined}
            onClick={() => startPractice("words")}
          >
            <span aria-hidden="true">ABC</span>
            Palavras
          </button>
          <button
            className={mode === "phrases" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "phrases" ? "page" : undefined}
            onClick={() => startPractice("phrases")}
          >
            <span aria-hidden="true">≡</span>
            Frases
          </button>
          <button
            className={mode === "free" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "free" ? "page" : undefined}
            onClick={() => goTo("free", "Modo digitação livre.")}
          >
            <span aria-hidden="true">⌨</span>
            Digitação livre
          </button>
          <button
            className={mode === "progress" ? "nav-button is-current" : "nav-button"}
            aria-current={mode === "progress" ? "page" : undefined}
            onClick={() => goTo("progress", "Abrindo seu progresso.")}
          >
            <span aria-hidden="true">★</span>
            Progresso
          </button>

          <div className="device-box">
            <p className="device-title">Célula física</p>
            <p className={connected ? "device-status is-connected" : "device-status"}>
              <span className="status-dot" aria-hidden="true"></span>
              {connected ? "Conectada" : "Desconectada"}
            </p>
            <button
              type="button"
              className="button button--secondary button--full"
              onClick={toggleSerial}
              disabled={!serialSupported()}
            >
              {connected ? "Desconectar" : "Conectar Arduino"}
            </button>
            {!serialSupported() && (
              <p className="helper-text">
                A conexão USB direta requer um navegador compatível com Web Serial.
              </p>
            )}
          </div>
        </aside>

        <main
          id="main-content"
          className="main-content"
          tabIndex="-1"
          aria-label={MODES[mode]}
        >
          <section className="live-message" aria-live="polite" aria-atomic="true">
            <div className="live-icon" aria-hidden="true">♪</div>
            <div>
              <span className="live-label">Mensagem do Braille UP!</span>
              <p>{feedback}</p>
            </div>
          </section>

          {mode === "home" && (
            <section aria-labelledby="home-title">
              <div className="hero-card">
                <div className="hero-copy">
                  <p className="section-kicker">Bem-vindo!</p>
                  <h2 id="home-title">Aprender Braille pode ser uma experiência multissensorial.</h2>
                  <p>
                    Use áudio, células táteis e um teclado identificado em Braille para aprender no seu ritmo.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button button--primary button--large"
                      onClick={() => goTo("letters", "Modo aprender letras. Escolha uma letra.")}
                    >
                      Começar pelas letras
                    </button>
                    <button
                      className="button button--secondary button--large"
                      onClick={() =>
                        speak(
                          "Bem-vindo ao Braille UP. Você pode aprender letras, praticar palavras, praticar frases curtas ou usar a digitação livre."
                        )
                      }
                    >
                      Ouvir orientação
                    </button>
                  </div>
                </div>

                <div className="hero-braille" aria-label="Exemplo visual de uma célula Braille">
                  <BrailleCell letter="B" />
                  <p><strong>Exemplo:</strong> letra B, pontos 1 e 2.</p>
                </div>
              </div>

              <h2 className="section-title">O que você quer fazer agora?</h2>
              <div className="action-grid">
                <button className="action-card" onClick={() => goTo("letters", "Escolha uma letra para aprender.")}>
                  <span className="action-number" aria-hidden="true">1</span>
                  <span className="action-title">Aprender letras</span>
                  <span className="action-description">Ouça a letra, conheça seus pontos e envie para a célula física.</span>
                </button>

                <button className="action-card" onClick={() => startPractice("words")}>
                  <span className="action-number" aria-hidden="true">2</span>
                  <span className="action-title">Praticar palavras</span>
                  <span className="action-description">Ouça uma palavra curta e digite usando o teclado adaptado.</span>
                </button>

                <button className="action-card" onClick={() => startPractice("phrases")}>
                  <span className="action-number" aria-hidden="true">3</span>
                  <span className="action-title">Praticar frases</span>
                  <span className="action-description">Treine frases simples e receba feedback por áudio.</span>
                </button>

                <button className="action-card" onClick={() => goTo("free", "Modo digitação livre.")}>
                  <span className="action-number" aria-hidden="true">4</span>
                  <span className="action-title">Digitação livre</span>
                  <span className="action-description">Explore o teclado, escreva e ouça as teclas pressionadas.</span>
                </button>
              </div>
            </section>
          )}

          {mode === "letters" && (
            <section aria-labelledby="letters-title">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Etapa 1</p>
                  <h2 id="letters-title">Aprender letras</h2>
                  <p>Escolha uma letra. O Braille UP! informa os pontos, fala em voz alta e pode acionar a célula física.</p>
                </div>
              </div>

              <div className="letter-layout">
                <div className="alphabet-panel">
                  <h3>Escolha uma letra</h3>
                  <div className="letter-grid" role="group" aria-label="Alfabeto">
                    {Object.keys(BRAILLE).map((letter) => (
                      <button
                        key={letter}
                        className={selectedLetter === letter ? "letter-button is-selected" : "letter-button"}
                        aria-pressed={selectedLetter === letter}
                        onClick={() => announceLetter(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="letter-detail-card">
                  <div className="letter-detail-top">
                    <div>
                      <span className="detail-label">Letra selecionada</span>
                      <div className="selected-letter" aria-hidden="true">{selectedLetter}</div>
                    </div>
                    <BrailleCell letter={selectedLetter} />
                  </div>

                  <div className="points-box">
                    <span>Pontos ativos</span>
                    <strong>{points.join(" • ")}</strong>
                  </div>

                  <div className="stack-actions">
                    <button className="button button--primary" onClick={() => announceLetter(selectedLetter)}>
                      Ouvir e mostrar novamente
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => sendCommand(`CHAR:${selectedLetter}`).catch(() => {})}
                      disabled={!connected}
                    >
                      Enviar para a célula física
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {(mode === "words" || mode === "phrases") && (
            <section aria-labelledby="practice-title">
              <div className="section-header">
                <div>
                  <p className="section-kicker">{mode === "words" ? "Etapa 2" : "Etapa 3"}</p>
                  <h2 id="practice-title">
                    {mode === "words" ? "Praticar palavras" : "Praticar frases curtas"}
                  </h2>
                  <p>Ouça com atenção e digite o que foi falado.</p>
                </div>
              </div>

              <div className="practice-card">
                <div className="challenge-box">
                  <span className="challenge-label">Desafio atual</span>
                  <p>
                    Pressione <strong>Ouvir desafio</strong> sempre que precisar repetir.
                  </p>
                  <button className="button button--audio button--large" onClick={hearChallenge}>
                    Ouvir desafio
                  </button>
                </div>

                <form onSubmit={checkAnswer} className="practice-form">
                  <label htmlFor="answer">Digite sua resposta</label>
                  <p id="answer-help" className="field-help">
                    Você pode usar o teclado com os adesivos em Braille. Pressione Enter ou use o botão para verificar.
                  </p>
                  <input
                    ref={answerRef}
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    spellCheck="false"
                    aria-describedby="answer-help"
                  />

                  <div className="practice-actions">
                    <button type="submit" className="button button--primary button--large">
                      Verificar resposta
                    </button>
                    <button type="button" className="button button--secondary button--large" onClick={nextChallenge}>
                      Novo desafio
                    </button>
                  </div>
                </form>

                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={speakKeys}
                    onChange={(e) => setSpeakKeys(e.target.checked)}
                  />
                  <span>
                    <strong>Falar as teclas digitadas</strong>
                    <small>Ajuda a confirmar cada letra encontrada no teclado.</small>
                  </span>
                </label>
              </div>
            </section>
          )}

          {mode === "free" && (
            <section aria-labelledby="free-title">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Exploração</p>
                  <h2 id="free-title">Digitação livre</h2>
                  <p>Escreva no seu ritmo. O Braille UP! pode falar cada tecla para auxiliar a localização.</p>
                </div>
              </div>

              <div className="free-card">
                <label htmlFor="free-text">Área de escrita</label>
                <textarea
                  id="free-text"
                  rows="8"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Comece a digitar aqui..."
                />
                <div className="practice-actions">
                  <button
                    className="button button--audio"
                    type="button"
                    disabled={!freeText.trim()}
                    onClick={() => speak(freeText)}
                  >
                    Ouvir o texto
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setFreeText("")}
                  >
                    Limpar
                  </button>
                </div>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={speakKeys}
                    onChange={(e) => setSpeakKeys(e.target.checked)}
                  />
                  <span>
                    <strong>Falar as teclas digitadas</strong>
                    <small>Você pode desligar esta opção a qualquer momento.</small>
                  </span>
                </label>
              </div>
            </section>
          )}

          {mode === "progress" && (
            <section aria-labelledby="progress-title">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Acompanhamento</p>
                  <h2 id="progress-title">Meu progresso</h2>
                  <p>Os dados ficam salvos somente neste navegador.</p>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{attempts}</span>
                  <span className="stat-label">Tentativas</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{correct}</span>
                  <span className="stat-label">Acertos</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{accuracy}%</span>
                  <span className="stat-label">Aproveitamento</span>
                </div>
              </div>

              <div className="progress-panel">
                <h3>Resumo</h3>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={accuracy}
                  aria-label={`Aproveitamento de ${accuracy} por cento`}
                >
                  <span style={{ width: `${accuracy}%` }}></span>
                </div>
                <p>{attempts === 0 ? "Faça uma atividade para começar a registrar seu progresso." : `Você acertou ${correct} de ${attempts} tentativas.`}</p>
                <button className="button button--danger" onClick={resetProgress}>
                  Zerar progresso
                </button>
              </div>
            </section>
          )}

          <footer className="content-footer">
            <p>
              <strong>Braille UP!</strong> — interface projetada com letras grandes, navegação por teclado, foco visível, áudio e opção de alto contraste.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
