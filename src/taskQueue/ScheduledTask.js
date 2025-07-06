/**
 * @typedef {import('../types/taskQueue.types.js').TaskFunction} TaskFunction
 * @typedef {import('../types/taskQueue.types.js').TaskOptions} TaskOptions
 * @typedef {import('../types/taskQueue.types.js').ErrorHandler} ErrorHandler
 * @typedef {import('../types/taskQueue.types.js').QueueOptions} QueueOptions
 * @typedef {import('../types/taskQueue.types.js').QueueStatus} QueueStatus
 * @typedef {import('../types/taskQueue.types.js').TaskStatus} TaskStatus
 * @typedef {import('../types/cache.types.js').HeapItem} HeapItem
 */

const Debounce = require('../utils/debounce.js');

/**
 * Representa uma tarefa agendada otimizada para uso com MinHeap
 * Fornece funcionalidades avançadas como debounce, priorização e controle de execuções
 * @class
 * @example
 * const task = new ScheduledTask('myTask', () => console.log('Hello'), 1000, {
 *   priority: 10,
 *   maxExecutions: 5
 *   onError: console.log,
 *   context: null,
 *   debounce: null,
 * });
 */
class ScheduledTask {
  /**
   * Cria uma nova instância de tarefa agendada
   * @param {string} id - Identificador único da tarefa
   * @param {TaskFunction} fn - Função a ser executada
   * @param {number} interval - Intervalo entre execuções em milissegundos
   * @param {TaskOptions} [options={}] - Opções avançadas da tarefa
   */
  constructor(id, fn, interval, options = {}) {
    /** @type {string} Identificador único da tarefa */
    this.id = id;

    /** @type {TaskFunction} Função a ser executada */
    this.fn = fn;

    /** @type {number} Intervalo entre execuções em milissegundos */
    this.interval = interval;

    /** @type {number} Timestamp da próxima execução calculada */
    this.nextExecution = Date.now() + interval;

    /** @type {number|null} Timestamp da última execução realizada */
    this.lastExecution = null;

    /** @type {number} Contador de execuções realizadas */
    this.executionCount = 0;

    /** @type {boolean} Flag indicando se a tarefa está ativa */
    this.isActive = true;

    /** @type {number} Prioridade da tarefa (maior valor = maior prioridade) */
    this.priority = options.priority || 0;

    /**@type {boolean} Se a tarefa está pausada */
    this.isPaused = false;
    
    /** @type {number|null} Timestamp em que a tarefa foi pausada */
    this.pausedAt = null

    /** @type {number} Número máximo de execuções permitidas */
    this.maxExecutions = options.maxExecutions || Infinity;

    /** @type {ErrorHandler|null} Callback para tratamento de erros */
    this.onError = options.onError || null;

    /** @type {number} Contador de erros ocorridos durante a execução da tarefa */
    this.errorCount = 0

    /** @type {Object|null} Contexto (this) para execução da função */
    this.context = options.context || null;

    // Integração com sistema de debounce
    /** @type {number|null} Tempo de debounce em milissegundos */
    this.debounceTime = options.debounce || null;

    /** @type {Debounce|null} Instância do debouncer se configurado */
    this.debouncer = this.debounceTime ? new Debounce(this.debounceTime) : null;
  }

  /**
   * Verifica se a tarefa deve ser executada agora
   * Considera ativação, timing e debounce
   * @returns {boolean} True se deve executar, false caso contrário
   */
  shouldExecute() {
    // Verifica se está ativa e se chegou o momento da execução
    if (!this.isActive || Date.now() < this.nextExecution) {
      return false;
    }

    // Verifica se o debounce permite a execução
    if (this.debouncer && !this.debouncer.canCall()) {
      return false;
    }

    return true;
  }

  /**
   * Executa a tarefa de forma assíncrona com tratamento de erros
   * Atualiza automaticamente o agendamento da próxima execução
   * @async
   * @returns {Promise<any>} Resultado da execução da função
   * @throws {Error} Propaga erros da função executada após tratamento
   */
  async execute() {
    try {
      // Reset do debouncer antes da execução
      if (this.debouncer) {
        this.debouncer.reset();
      }

      // Executa a função no contexto especificado
      const result = await this.fn.call(this.context);

      // Agenda próxima execução após sucesso
      this.scheduleNext();
      return result;
    } catch (error) {
      // Chama handler de erro se configurado
      if (this.onError) {
        this.onError(error, this);
      }

      this.errorCount++

      // Agenda próxima execução mesmo com erro
      this.scheduleNext();

      // Propaga o erro para o caller
      throw error;
    }
  }

  /**
   * Agenda a próxima execução da tarefa
   * Atualiza contadores e verifica limite de execuções
   * @private
   */
  scheduleNext() {
    // Atualiza timestamp da última execução
    this.lastExecution = Date.now();

    // Calcula próxima execução baseada no intervalo
    this.nextExecution = this.lastExecution + this.interval;

    // Incrementa contador de execuções
    this.executionCount++;

    // Desativa se atingiu limite máximo de execuções
    if (this.executionCount >= this.maxExecutions) {
      this.isActive = false;
    }
  }

  /**
   * Configura ou remove o debounce da tarefa
   * @param {number|null} debounceTime - Tempo de debounce em ms ou null para remover
   */
  setDebounce(debounceTime) {
    // Armazena novo tempo de debounce
    this.debounceTime = debounceTime;

    if (debounceTime) {
      // Atualiza debouncer existente ou cria novo
      if (this.debouncer) {
        this.debouncer.setWait(debounceTime);
      } else {
        this.debouncer = new Debounce(debounceTime);
      }
    } else {
      // Remove debouncer se tempo for null/undefined
      this.debouncer = null;
    }
  }

  /**
   * Reseta o estado do debounce permitindo execução imediata
   */
  resetDebounce() {
    // Reseta debouncer se existir
    if (this.debouncer) {
      this.debouncer.reset();
    }
  }

  /**
   * Calcula tempo restante até a próxima execução
   * @returns {number} Tempo em milissegundos (0 se já deveria executar)
   */
  timeUntilNext() {
    return Math.max(0, this.nextExecution - Date.now());
  }

  /**
   * NOVA FUNCIONALIDADE: Converte tarefa para item compatível com MinHeap
   * Cria estrutura otimizada para ordenação automática por tempo de execução
   * @returns {HeapItem} Item formatado para heap com chave e tempo de expiração
   * @example
   * const heapItem = task.toHeapItem();
   * // { key: 'taskId', expiresAt: 1234567890, task: ScheduledTask }
   */
  toHeapItem() {
    return {
      /** @type {string} Chave única para identificação no heap */
      key: this.id,

      /** @type {number} Timestamp quando a tarefa deve ser executada */
      expiresAt: this.nextExecution,

      /** @type {ScheduledTask} Referência para a instância completa da tarefa
      task: this // Referência para a tarefa completa
       */
    };
  }
}

module.exports = ScheduledTask;
