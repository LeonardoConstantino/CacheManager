/**
 * Classe para controle de frequência de execução com debounce.
 * Permite bloquear chamadas sucessivas dentro de um intervalo.
 */
class Debounce {
  /**
   * @param {number} wait - Intervalo de tempo mínimo (ms) entre execuções permitidas.
   */
  constructor(wait) {
    if (typeof wait !== 'number' || wait < 0) {
      throw new Error('O tempo de espera (wait) deve ser um número positivo.');
    }
    this.wait = wait;
    this.lastCall = 0;
  }

  /**
   * Verifica se a chamada pode ser executada com base no intervalo configurado.
   * Atualiza o timestamp se permitido.
   * @returns {boolean} - true se a chamada for permitida, false se estiver dentro do intervalo de bloqueio.
   */
  canCall() {
    const now = Date.now();
    if (now - this.lastCall >= this.wait) {
      this.lastCall = now;
      return true;
    }
    return false;
  }

  /**
   * Seta um novo intervalo de tempo de espera.
   * @param {*} newWait 
   */
  setWait(newWait) {
    if (typeof newWait !== 'number' || newWait < 0) {
      throw new Error('O novo tempo de espera (newWait) deve ser um número positivo.');
    }
    this.wait = newWait;
  }

  /**
   * Reinicia o estado do debounce (força liberação imediata na próxima verificação).
   */
  reset() {
    this.lastCall = 0;
  }
}

module.exports = Debounce;

/*
const debounce = new Debounce(1000);
debounce.canCall(); // true
debounce.setWait(500);
debounce.reset();
*/