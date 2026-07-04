export class QuizModal {
  constructor(onComplete, getAudio) {
    this.modal = document.getElementById('quiz-modal');
    this.questionEl = document.getElementById('quiz-question');
    this.optionsContainer = document.getElementById('quiz-options');
    this.feedbackEl = document.getElementById('quiz-feedback');
    this.counterEl = document.getElementById('quiz-counter');
    this.onCompleteCallback = onComplete;
    this.getAudio = getAudio || (() => null);
  }

  show(questionData, onComplete) {
    // Callback por chamada (permite encadear várias perguntas em sequência);
    // se ausente, usa o do construtor
    this._onComplete = onComplete || this.onCompleteCallback;

    this.modal.style.display = 'flex';
    this.questionEl.textContent = questionData.question;
    this.optionsContainer.innerHTML = '';
    this.feedbackEl.style.display = 'none';

    // Contador "Pergunta X de N" quando há uma sequência
    if (this.counterEl) {
      this.counterEl.textContent = questionData.counter || '';
      this.counterEl.style.display = questionData.counter ? 'block' : 'none';
    }

    // Embaralha as opções para a resposta certa não ficar sempre na mesma posição
    const options = [...questionData.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt.text;
      
      btn.onclick = () => {
        const audio = this.getAudio();
        if (opt.isCorrect) {
          if (audio) audio.chime();
          btn.classList.add('correct');
          this.feedbackEl.style.color = '#34c759';
          this.feedbackEl.textContent = '✅ Correto! Boa leitura do cenário.';
          this.feedbackEl.style.display = 'block';
          
          // Disable all buttons
          Array.from(this.optionsContainer.children).forEach(child => child.disabled = true);
          
          // Wait 1.5s then close
          setTimeout(() => {
            this.modal.style.display = 'none';
            if (this._onComplete) this._onComplete();
          }, 1500);

        } else {
          // Wrong answer
          if (audio) audio.buzz();
          btn.classList.add('wrong');
          this.feedbackEl.style.color = '#ff3b30';
          this.feedbackEl.textContent = '❌ Errado! ' + opt.feedback;
          this.feedbackEl.style.display = 'block';
          
          // Remove shake animation class after it completes so it can shake again if clicked
          setTimeout(() => {
            btn.classList.remove('wrong');
          }, 400);
        }
      };

      this.optionsContainer.appendChild(btn);
    });
  }
}
