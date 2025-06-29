/**
 * @typedef {import('../types/log.types.js').LogLevels} LogLevels
 * @typedef {import('../types/log.types.js').LogLevelValue} LogLevelValue
 */
/**
 * Módulo para medição e logging de desempenho de operações
 * @module PerformanceTimer
 * @see LogLevels
 * @see formatDuration
 */

const { logLevel, log } = require('./log.js');
const { formatDuration } = require('./utils.js');

/**
 * Executa uma função e registra o tempo de execução com detalhes
 * @function logTimer
 * @param {Function} fn - Função a ser executada e cronometrada
 * @param {string} [functionName] - Nome amigável para identificação nos logs
 * @param {LogLevelValue} [level=logLevel.INFO] - Nível de log (DEBUG, INFO, WARN, ERROR)
 * @param {...any} args - Argumentos para passar à função
 * @returns {Promise<any>} Promise que resolve com o resultado da função
 * 
 * @example
 * // Exemplo síncrono
 * const result = await logTimer(
 *   () => Math.sqrt(16),
 *   'calcularRaizQuadrada',
 *   logLevel.DEBUG
 * );
 * 
 * @example
 * // Exemplo assíncrono
 * const data = await logTimer(
 *   async (url) => {
 *     const response = await fetch(url);
 *     return response.json();
 *   },
 *   'fetchDadosAPI',
 *   logLevel.INFO,
 *   'https://api.example.com/data'
 * );
 */
const logTimer = async (fn, functionName, level = logLevel.INFO, ...args) => {
  const name = functionName || fn.name || 'anonymous function';
  const startTime = performance.now();

  log(level, `⏱️ Iniciando execução de: ${name}`);

  try {
    const result = await Promise.resolve(fn(...args));
    const endTime = performance.now();
    const duration = endTime - startTime;
    const formattedDuration = formatDuration(duration);

    log(level, `✅ ${name} executada com sucesso`, {
      duration: formattedDuration,
      durationMs: Math.round(duration * 100) / 100,
    });

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const formattedDuration = formatDuration(duration);

    log(logLevel.ERROR, `❌ Erro em ${name}`, {
      duration: formattedDuration,
      durationMs: Math.round(duration * 100) / 100,
      error: error,
    });

    throw error;
  }
};

/**
 * Decorator que adiciona medição de tempo a uma função
 * @function withTimer
 * @param {Function} fn - Função original a ser decorada
 * @param {string} [functionName] - Nome amigável para logs
 * @param {LogLevelValue} [level=logLevel.INFO] - Nível de log
 * @returns {Function} Função decorada com medição de tempo
 * 
 * @example
 * // Decorando uma função existente
 * const fetchWithTimer = withTimer(
 *   fetchData,
 *   'fetchDataDecorated',
 *   logLevel.DEBUG
 * );
 * 
 * // Usando a função decorada
 * const result = await fetchWithTimer('param1', 'param2');
 */
const withTimer = (fn, functionName, level = logLevel.INFO) => {
  const name = functionName || fn.name || 'decorated function';

  return async function (...args) {
    return await logTimer(fn, name, level, ...args);
  };
};

/**
 * Sistema de timer manual para medição granular com múltiplos checkpoints
 * @class Timer
 * 
 * @example
 * // Exemplo básico de uso
 * const timer = new Timer('ProcessamentoDados', logLevel.DEBUG);
 * timer.start();
 * // ... operação 1
 * timer.checkpoint('Carregamento');
 * // ... operação 2
 * timer.checkpoint('Transformacao');
 * const stats = timer.end();
 */
class Timer {
  /**
   * Cria uma instância de Timer
   * @constructor
   * @param {string} name - Identificador único para o timer
   * @param {LogLevelValue} [level=logLevel.INFO] - Nível de log padrão
   */
  constructor(name, level = logLevel.INFO) {
    /** 
     * Nome identificador do timer
     * @type {string}
     * @public
     */
    this.name = name;
    
    /**
     * Nível de log para operações
     * @type {LogLevelValue}
     * @public
     */
    this.level = level;
    
    /**
     * Timestamp de início
     * @type {?number}
     * @private
     */
    this.startTime = null;
    
    /**
     * Registro de checkpoints
     * @type {Array<Object>}
     * @private
     */
    this.checkpoints = [];
  }

  /**
   * Inicia a contagem de tempo
   * @method start
   * @returns {Timer} Instância atual para method chaining
   * 
   * @example
   * timer.start()
   *   .checkpoint('fase1')
   *   .checkpoint('fase2');
   */
  start() {
    this.startTime = performance.now();
    this.checkpoints = [];
    log(this.level, `⏱️ Timer iniciado: ${this.name}`);
    return this;
  }

  /**
   * Registra um checkpoint intermediário
   * @method checkpoint
   * @param {string} label - Identificador do checkpoint
   * @returns {Timer} Instância atual para method chaining
   */
  checkpoint(label) {
    if (!this.startTime) {
      log(logLevel.WARN, `⚠️ Timer ${this.name} não foi iniciado`);
      return this;
    }

    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    const stepTime = lastCheckpoint
      ? currentTime - lastCheckpoint.timestamp
      : elapsed;

    const checkpoint = {
      label,
      elapsed: Math.round(elapsed * 100) / 100,
      stepTime: Math.round(stepTime * 100) / 100,
      timestamp: currentTime,
    };

    this.checkpoints.push(checkpoint);

    log(this.level, `📍 ${this.name} - ${label}`, {
      elapsed: formatDuration(elapsed),
      stepTime: formatDuration(stepTime),
    });

    return this;
  }

  /**
   * Finaliza o timer e retorna estatísticas
   * @method end
   * @returns {Object} Estatísticas de desempenho
   * @property {string} name - Nome do timer
   * @property {number} totalDuration - Tempo total em ms
   * @property {string} totalFormatted - Tempo total formatado
   * @property {Array} checkpoints - Detalhes dos checkpoints
   */
  end() {
    if (!this.startTime) {
      log(logLevel.WARN, `⚠️ Timer ${this.name} não foi iniciado`);
      return null;
    }

    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const stats = {
      name: this.name,
      totalDuration: Math.round(totalDuration * 100) / 100,
      totalFormatted: formatDuration(totalDuration),
      checkpoints: this.checkpoints,
    };

    log(this.level, `🏁 Timer finalizado: ${this.name}`, stats);

    // Reset para reutilização
    this.startTime = null;
    this.checkpoints = [];

    return stats;
  }
}

module.exports = {
  logTimer,
  withTimer,
  Timer,
};
