/**
 * @typedef {import('../types/taskQueue.types.js').TaskFunction} TaskFunction
 * @typedef {import('../types/taskQueue.types.js').TaskOptions} TaskOptions
 * @typedef {import('../types/taskQueue.types.js').ErrorHandler} ErrorHandler
 * @typedef {import('../types/taskQueue.types.js').QueueOptions} QueueOptions
 * @typedef {import('../types/taskQueue.types.js').PerformanceMetrics} PerformanceMetrics
 * @typedef {import('../types/taskQueue.types.js').ExecutionTimeStats} ExecutionTimeStats
 * @typedef {import('../types/taskQueue.types.js').QueueStatus} QueueStatus
 * @typedef {import('../types/taskQueue.types.js').TaskQueueMetrics} TaskQueueMetrics
 * @typedef {import('../types/taskQueue.types.js').TaskStatus} TaskStatus
 * @typedef {import('../types/cache.types.js').HeapItem} HeapItem
 */

const MinHeap = require('../expiration/TTLHeap.js');
const ScheduledTask = require('./ScheduledTask.js');

/**
 * Fila inteligente otimizada com MinHeap para alta performance
 * Gerencia execução eficiente de tarefas agendadas com recursos avançados
 * @class
 * @example
 * const queue = new TaskQueue({
 *   minTickInterval: 50,
 *   maxConcurrent: 3,
 *   logger: customLogger
 * });
 *
 * queue.addTask('backup', backupFunction, 60000, { priority: 10 });
 * queue.start();
 */
class TaskQueue {
  /**
   * Cria nova instância da fila otimizada
   * @param {QueueOptions} [options={}] - Opções de configuração da fila
   */
  constructor(options = {}) {
    /** @type {Map<string, ScheduledTask>} Mapa de tarefas indexadas por ID para acesso O(1) */
    this.tasks = new Map();

    /** @type {MinHeap} Heap binário mínimo para ordenação eficiente por próxima execução */
    this.executionHeap = new MinHeap();

    /** @type {boolean} Flag indicando se a fila está processando tarefas */
    this.isRunning = false;

    /** @type {NodeJS.Timeout|null} Timer dinâmico otimizado para próximo tick */
    this.dynamicTimer = null;

    /** @type {number} Intervalo mínimo entre verificações para evitar busy-waiting */
    this.minTickInterval = options.minTickInterval || 100;

    /** @type {number} Intervalo máximo entre verificações para evitar atrasos */
    this.maxTickInterval = options.maxTickInterval ?? 5000;

    /** @type {number} Máximo de tarefas executando simultaneamente */
    this.maxConcurrent = options.maxConcurrent || 1;

    /** @type {Set<string>} Conjunto de IDs das tarefas atualmente em execução */
    this.currentlyExecuting = new Set();

    /** @type {boolean} Flag indicando se o objeto foi destruído, prevenindo operações em estado inválido */
    this.destroyed = false;

    /** @type {QueueStatus} Objeto com estatísticas detalhadas de performance */
    this.stats = {
      /**@type {boolean} Indica se a fila está em execução */
      isRunning: this.isRunning,

      /**@type {number} Total de tarefas na fila */
      totalTasks: this.tasks.size,

      /** @type {number} Total de execuções realizadas */
      totalExecutions: 0,

      /** @type {number} Total de erros ocorridos durante execuções */
      totalErrors: 0,

      /**@type {number} Número de tarefas ativas */
      activeTasks: 0,
      /**@type {number} Número de tarefas executando atualmente*/
      currentlyExecuting: 0,
      /**@type {number|null} Tempo até próxima execução em ms*/
      nextExecutionIn: 0,
      /**@type {number} Tamanho atual do heap de execução*/
      heapSize: 0,
      /**@type {number} Total de tarefas pausadas*/
      pausedTasks: 0,
      /**@type {string} Tempo de atividade da fila formatado*/
      uptime: '',
      /**@type {number} Tempo de atividade em milissegundos*/
      uptimeMs: 0,
      /**@type {string} Eficiência do heap em percentual*/
      heapEfficiency: '',
      /**@type {string} Taxa de erro em percentual*/
      errorRate: '',
      /**@type {string} Execuções por minuto*/
      executionsPerMinute: '',
      /**@type {number} Tempo médio entre execuções em ms*/
      avgTimeBetweenExecutions: 0,
      /**@type {PerformanceMetrics} Métricas detalhadas de performance*/
      performance: {
        availableConcurrencySlots: 0,
        concurrencyUtilization: '0%',
        executionTimeStats: {
          min: 0,
          max: 0,
          median: 0,
          average: 0,
        },
        throughput: '',
        priorityDistribution: {
          high: 0,
          medium: 0,
          low: 0,
          custom: {},
        },
      },

      /** @type {number} NOVA métrica - Total de execuções puladas por debounce */
      totalSkippedByDebounce: 0,

      /** @type {number|null} Timestamp de quando a fila foi iniciada */
      queueStartTime: null,

      /** @type {number|null} Timestamp de quando a fila foi parada */
      queueStopTime: null,

      /** @type {number} Tempo médio de execução das tarefas em ms */
      avgExecutionTime: 0,

      /** @type {number[]} Array com os últimos tempos de execução (máx 100) */
      executionTimes: [],

      /** @type {string} Porcentagem de eficiência do mecanismo de debounce */
      debounceEfficiency: '0%',
    };

    /** @type {Object} Objeto para logging com métodos info, warn, error, debug */
    this.logger = options.logger || console;
  }
  /**
   * Adiciona nova tarefa à fila e mantém heap organizado automaticamente
   * Substitui tarefa existente se ID já existir
   * @param {string} id - Identificador único da tarefa
   * @param {TaskFunction} fn - Função a ser executada
   * @param {number} interval - Intervalo entre execuções em milissegundos
   * @param {TaskOptions} [options={}] - Opções avançadas da tarefa
   * @returns {TaskQueue} Retorna this para method chaining
   * @example
   * queue.addTask('sync', syncData, 30000, {
   *   priority: 10,
   *   maxExecutions: 5
   *   onError: console.log,
   *   context: null,
   *   debounce: null,
   * });
   */
  addTask(id, fn, interval, options = {}) {
    // Verifica se tarefa já existe
    if (this.tasks.has(id)) {
      // Remove da heap antes de substituir para evitar duplicatas
      this.removeFromHeap(id);
      this.logger.warn(`Tarefa '${id}' substituída`);
    }

    // Cria nova instância da tarefa com parâmetros fornecidos
    const task = new ScheduledTask(id, fn, interval, options);

    // Adiciona ao mapa para acesso rápido por ID
    this.tasks.set(id, task);

    // OTIMIZAÇÃO: Adiciona automaticamente ao heap para ordenação
    this.executionHeap.push(task.toHeapItem());

    // Gera informação sobre debounce para log
    const debounceInfo = options.debounce
      ? ` (debounce: ${options.debounce}ms)`
      : '';
    this.logger.info(
      `Tarefa '${id}' adicionada (intervalo: ${interval}ms${debounceInfo})`
    );

    // Inicia processamento automaticamente se não estiver rodando
    if (!this.isRunning) {
      this.start();
    }

    return this;
  }

  /**
   * Remove tarefa da fila e do heap de execução
   * Para a fila automaticamente se não restarem tarefas
   * @param {string} id - ID da tarefa a ser removida
   * @returns {boolean} True se tarefa foi removida, false se não existia
   */
  removeTask(id) {
    // Tenta remover do mapa de tarefas
    const removed = this.tasks.delete(id);

    if (removed) {
      // Remove também do heap de execução
      this.removeFromHeap(id);
      this.logger.info(`Tarefa '${id}' removida`);

      // Para a fila se não há mais tarefas
      if (this.tasks.size === 0) {
        this.stop();
      }
    }

    return removed;
  }

  /**
   * OTIMIZAÇÃO: Remove item específico do heap por ID
   * @private
   * @param {string} id - ID da tarefa a ser removida do heap
   */
  removeFromHeap(id) {
    const removed = this.executionHeap.remove(id);
    if (!removed) {
      this.logger.debug(`ℹ️ Nenhum item com id '${id}' encontrado no heap.`);
    } else {
      this.logger.debug(`✔️ Tarefa '${id}' removida do heap.`);
    }
  }

  /**
   * OTIMIZAÇÃO: Inicia processamento com timer dinâmico baseado na próxima execução
   * Timer se adapta automaticamente ao timing das tarefas
   */
  start() {
    // Previne múltiplas inicializações
    if (this.isRunning) return;

    // Marca como executando e registra timestamp
    this.isRunning = true;
    this.stats.queueStartTime = Date.now();

    this.logger.info('Iniciando processamento otimizado');

    // Inicia loop de processamento otimizado
    this.scheduleNextTick();
  }

  /**
   * INOVAÇÃO: Timer dinâmico que calcula o próximo tick automaticamente
   * Evita polling desnecessário ajustando delay baseado na próxima tarefa
   * @private
   */
  scheduleNextTick() {
    // Para se a fila foi parada
    if (!this.isRunning) return;

    // Limpa timer anterior para evitar acúmulo
    if (this.dynamicTimer) {
      clearTimeout(this.dynamicTimer);
    }

    // Calcula delay ótimo para próximo tick
    const nextTickDelay = this.calculateNextTickDelay();

    // Agenda próximo processamento com delay calculado
    this.dynamicTimer = setTimeout(() => {
      // Processa tarefas assincronamente
      this._processTasks().then(() => {
        // Agenda próximo tick após processamento completado
        this.scheduleNextTick();
      });
    }, nextTickDelay);
  }

  /**
   * OTIMIZAÇÃO: Calcula delay ótimo para próximo tick baseado no heap
   * Evita verificações desnecessárias calculando exatamente quando verificar
   * @private
   * @returns {number} Delay em milissegundos para próximo tick
   */
  calculateNextTickDelay() {
    // Se não há tarefas no heap, usa intervalo mínimo
    if (this.executionHeap.size() === 0) {
      return this.minTickInterval;
    }

    // Obtém próxima tarefa do topo do heap (menor tempo)
    const nextItem = this.executionHeap.peek();
    if (!nextItem) {
      return this.minTickInterval;
    }

    // Calcula tempo preciso até próxima execução
    const timeUntilNext = Math.max(0, nextItem.expiresAt - Date.now());

    // Retorna o menor valor entre tempo calculado e intervalo mínimo
    // Limitado a 5000ms para evitar delays muito longos
    return Math.max(this.minTickInterval, Math.min(timeUntilNext, 5000));
  }

  /**
   * Para o processamento da fila e limpa timers
   * Registra timestamp de parada para estatísticas
   */
  stop() {
    // Ignora se já está parada
    if (!this.isRunning) return;

    // Marca como parada e registra timestamp
    this.isRunning = false;
    this.stats.queueStopTime = Date.now();

    // Limpa timer ativo para liberar recursos
    if (this.dynamicTimer) {
      clearTimeout(this.dynamicTimer);
      this.dynamicTimer = null;
    }

    this.logger.info('Processamento parado');
  }

  /**
   * Pausa uma tarefa específica da fila.
   * Marca a tarefa como pausada sem afetar a prioridade.
   * @param {string} id
   */
  pauseTask(id) {
    const task = this.tasks.get(id);
    if (task && !task.isPaused) {
      task.isPaused = true;
      task.pausedAt = Date.now();
      this.logger.info(`Tarefa '${id}' pausada`);
    }
  }

  /**
   * Retoma uma tarefa previamente pausada.
   * @param {string} id
   */
  resumeTask(id) {
    const task = this.tasks.get(id);
    if (task && task.isPaused) {
      task.isPaused = false;
      this.logger.info(`Tarefa '${id}' resumida`);
    }
  }

  /**
   * Retorna status completo e otimizado com informações do heap
   * Fornece visão detalhada do estado atual da fila incluindo novas métricas
   * de performance, eficiência e análise de problemas
   *
   * @returns {TaskQueueMetrics} Objeto com status completo da fila incluindo métricas avançadas
   * @example
   * const status = queue.getStatus();
   * console.log(`Executando: ${status.currentlyExecuting}/${status.maxConcurrent}`);
   * console.log(`Próxima execução em: ${status.nextExecutionIn}ms`);
   * console.log(`Uptime: ${status.uptime}`);
   * console.log(`Taxa de erro: ${status.errorRate}`);
   * console.log(`Throughput: ${status.performance.throughput} tarefas/s`);
   *
   * @since 1.0.0
   * @memberof QueueManager
   */
  getStatus() {
    const activeTasks = Array.from(this.tasks.values()).filter(
      (t) => t.isActive
    );
    const pausedTasks = Array.from(this.tasks.values()).filter(
      (t) => t.isPaused
    );

    // Calcula tempo até próxima execução
    const nextExecution =
      this.executionHeap && this.executionHeap.size() > 0
        ? Math.max(
            0,
            this.executionHeap.peek()?.expiresAt || 0 - Date.now() || 0
          )
        : null;

    // NOVA MÉTRICA: Calcula uptime da fila
    const uptime = this.stats.queueStartTime
      ? Date.now() - this.stats.queueStartTime
      : 0;

    // NOVA MÉTRICA: Detecta possível vazamento de heap
    const heapEfficiency =
      this.tasks.size > 0
        ? (
            (this.tasks.size / Math.max(this.executionHeap.size(), 1)) *
            100
          ).toFixed(2)
        : '100.00';

    // NOVA MÉTRICA: Calcula taxa de erro
    const errorRate =
      this.stats.totalExecutions > 0
        ? ((this.stats.totalErrors / this.stats.totalExecutions) * 100).toFixed(
            2
          )
        : '0.00';

    // NOVA MÉTRICA: Calcula execuções por minuto
    const executionsPerMinute =
      uptime > 0
        ? (this.stats.totalExecutions / (uptime / 60000) || 0).toFixed(2)
        : '0.00';

    // NOVA MÉTRICA: Analisa distribuição de prioridades
    const priorityDistribution = this._analyzePriorityDistribution();

    // NOVA MÉTRICA: Calcula tempo médio entre execuções
    const avgTimeBetweenExecutions = this._calculateExecutionIntervalEstimate();

    // NOVA MÉTRICA: Detecta tarefas problemáticas
    const problematicTasks = this._detectProblematicTasks();

    return {
      // Métricas básicas existentes
      isRunning: this.isRunning,
      totalTasks: this.tasks.size,
      activeTasks: activeTasks.length,
      currentlyExecuting: this.currentlyExecuting.size,
      nextExecutionIn: nextExecution,
      heapSize: this.executionHeap?.size() || 0,

      // ==========================================
      // NOVAS MÉTRICAS ESSENCIAIS
      // ==========================================

      /** @type {number} Total de tarefas pausadas */
      pausedTasks: pausedTasks.length,

      /** @type {string} Tempo que a fila está ativa (formato legível) */
      uptime: this._formatUptime(uptime),

      /** @type {number} Uptime em milissegundos */
      uptimeMs: uptime,

      /** @type {string} Eficiência do heap (% de tarefas vs itens no heap) */
      heapEfficiency: heapEfficiency + '%',

      /** @type {string} Taxa de erro percentual */
      errorRate: errorRate + '%',

      /** @type {string} Execuções por minuto */
      executionsPerMinute: executionsPerMinute,

      /** @type {number} Tempo médio entre execuções em ms */
      avgTimeBetweenExecutions: avgTimeBetweenExecutions,

      // ==========================================
      // MÉTRICAS DE PERFORMANCE
      // ==========================================
      performance: {
        /** @type {number} Slots de concorrência disponíveis */
        availableConcurrencySlots:
          this.maxConcurrent - this.currentlyExecuting.size,

        /** @type {string} Utilização da concorrência */
        concurrencyUtilization:
          ((this.currentlyExecuting.size / this.maxConcurrent) * 100).toFixed(
            2
          ) + '%',

        /** @type {ExecutionTimeStats} Tempo mínimo/máximo/mediano de execução */
        executionTimeStats: this._calculateExecutionTimeStats(),

        /** @type {string} Throughput (tarefas/segundo) */
        throughput:
          uptime > 0
            ? (this.stats.totalExecutions / (uptime / 1000) || 0).toFixed(2)
            : '0.00',

        /** @type {Object} Distribuição de prioridades */
        priorityDistribution: priorityDistribution,
      },

      // ==========================================
      // MÉTRICAS DE SAÚDE DO SISTEMA
      // ==========================================
      health: {
        /** @type {string} Status geral da fila */
        status: this._calculateHealthStatus(),

        /** @type {boolean} Se há possível vazamento de heap */
        possibleHeapLeak: this.executionHeap.size() > this.tasks.size * 3,

        /** @type {boolean} Se há tarefas travadas */
        hasStuckTasks:
          this.currentlyExecuting.size > 0 && this.stats.totalExecutions === 0,

        /** @type {string[]} Alertas detectados */
        alerts: this._generateHealthAlerts(),

        /** @type {Object[]} Tarefas problemáticas */
        problematicTasks: problematicTasks,
      },

      // ==========================================
      // MÉTRICAS DE DEBOUNCE
      // ==========================================
      debounceMetrics: {
        /** @type {number} Total de tarefas com debounce */
        tasksWithDebounce: Array.from(this.tasks.values()).filter(
          (t) => t.debouncer
        ).length,

        /** @type {string} Eficiência do debounce atualizada */
        debounceEfficiency: this._calculateDebounceEfficiency(),

        /** @type {number} Economia de execuções pelo debounce */
        executionsSaved: this.stats.totalSkippedByDebounce,
      },

      // Estatísticas existentes aprimoradas
      stats: {
        ...this.stats,
        debounceEfficiency: this._calculateDebounceEfficiency(),
      },

      // Detalhes das tarefas com métricas adicionais
      taskDetails: Array.from(this.tasks.values()).map((task) => ({
        id: task.id,
        isActive: task.isActive,
        isPaused: task.isPaused || false,
        executionCount: task.executionCount,
        nextExecutionIn: task.timeUntilNext(),
        priority: task.priority,

        // NOVAS MÉTRICAS POR TAREFA
        /** @type {string} Última execução (tempo relativo) */
        lastExecution: task.lastExecution
          ? this._formatRelativeTime(Date.now() - task.lastExecution)
          : 'Nunca',

        /** @type {string} Frequência de execução */
        executionFrequency:
          task.executionCount > 0 && uptime > 0
            ? (task.executionCount / (uptime / 60000) || 0).toFixed(2) + '/min'
            : '0/min',

        /** @type {string} Status da tarefa */
        status: this._getTaskStatus(task),

        debounce: {
          enabled: !!task.debouncer,
          time: task.debounceTime ?? 0,
          canCall: task.debouncer ? task.debouncer.canCall() : true,
          /** @type {string} Tempo restante de debounce */
          timeRemaining: task.debouncer
            ? this._getDebounceTimeRemaining(task)
            : '0ms',
        },
      })),
    };
  }

  /**
   * Configura debounce para tarefa específica
   * Permite ajuste dinâmico de debounce durante execução
   * @param {string} id - ID da tarefa a configurar
   * @param {number|null} debounceTime - Tempo de debounce em ms ou null para remover
   * @returns {boolean} True se tarefa foi encontrada e configurada
   * @example
   * queue.setTaskDebounce('apiCall', 2000); // 2 segundos de debounce
   * queue.setTaskDebounce('apiCall', null);  // Remove debounce
   */
  setTaskDebounce(id, debounceTime) {
    // Busca tarefa pelo ID
    const task = this.tasks.get(id);
    if (task) {
      // Aplica configuração de debounce
      task.setDebounce(debounceTime);

      // Gera mensagem descritiva da ação
      const action = debounceTime
        ? `configurado para ${debounceTime}ms`
        : 'removido';
      this.logger.info(`Debounce da tarefa '${id}' ${action}`);
      return true;
    }
    return false;
  }

  /**
   * Reseta debounce de tarefa específica permitindo execução imediata
   * @param {string} id - ID da tarefa para resetar debounce
   * @returns {boolean} True se tarefa foi encontrada e resetada
   */
  resetTaskDebounce(id) {
    // Busca tarefa pelo ID
    const task = this.tasks.get(id);
    if (task) {
      // Reseta estado do debounce
      task.resetDebounce();
      this.logger.debug(`Debounce da tarefa '${id}' resetado`);
      return true;
    }
    return false;
  }

  /**
   * Executa tarefa imediatamente ignorando debounce temporariamente
   * @param {string} id - ID da tarefa a executar
   * @returns {Promise<any>} Resultado da execução da tarefa
   * @throws {Error} Se tarefa não for encontrada
   * @example
   * try {
   *   const result = await queue.executeNow('backup');
   *   console.log('Backup executado:', result);
   * } catch (error) {
   *   console.error('Erro no backup:', error);
   * }
   */
  async executeNow(id) {
    // Busca tarefa pelo ID
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Tarefa '${id}' não encontrada`);
    }

    // Salva estado original do debouncer para restaurar depois
    const originalDebouncer = task.debouncer;

    // Remove debouncer temporariamente para execução imediata
    task.debouncer = null;

    try {
      this.logger.info(`Execução imediata de '${id}'`);

      // Executa tarefa sem debounce
      return await this._executeTask(task);
    } finally {
      // Restaura debouncer original em qualquer caso
      task.debouncer = originalDebouncer;
    }
  }

  /**
   * Limpa completamente a fila removendo todas as tarefas
   * Para o processamento e limpa estruturas de dados
   */
  clear() {
    // Limpa mapa de tarefas
    this.tasks.clear();

    // Limpa heap de execução
    this.executionHeap.clear();

    // Limpa conjunto de tarefas executando
    this.currentlyExecuting.clear();

    // Para processamento
    this.stop();

    this.logger.info('Fila limpa');
  }

  /**
   * Destrói completamente a instância da fila liberando recursos
   * Deve ser chamado quando a fila não será mais utilizada
   */
  destroy() {
    // Limpa todas as estruturas de dados
    this.clear();

    // Remove referências para facilitar garbage collection
    //@ts-ignore
    this.stats = null;
    this.logger = null;
    this._destroyed = true;
  }

  // ==========================================
  //            MÉTODOS PRIVADOS
  // ==========================================

  /**
   * OTIMIZAÇÃO: Processa apenas tarefas prontas usando heap para eficiência
   * Extrai tarefas do heap, ordena por prioridade e executa respeitando concorrência
   * @private
   * @async
   */
  async _processTasks() {
    if (this.tasks.size === 0) {
      this.stop();
      return;
    }

    const currentTime = Date.now();
    const allItems = this.executionHeap.extractAll(); // Esvazia o heap e nos dá uma cópia
    const tasksToReinsert = [];
    let readyTasks = [];

    for (const item of allItems) {
      const task = this.tasks.get(item.key);

      // Validação: descarta tarefas órfãs ou inativas
      if (!task || !task.isActive) {
        this.logger.debug(`Item descartado: ${item.key} (inativo ou órfão)`);
        continue;
      }

      // Triagem: tarefa pronta ou futura?
      if (item.expiresAt <= currentTime) {
        // Tarefa está pronta. Verificar debounce.
        if (task.shouldExecute()) {
          readyTasks.push(task);
        } else {
          this.stats.totalSkippedByDebounce++;
          this.logger.debug(`Tarefa '${task.id}' pulada por debounce.`);
          // A tarefa pulada também deve ser reinserida.
          tasksToReinsert.push(task);
        }
      } else {
        // Tarefa ainda não está pronta, deve voltar para o heap.
        tasksToReinsert.push(task);
      }
    }

    // Re-adiciona as tarefas que foram executadas também, pois elas precisam de um novo agendamento.
    readyTasks.forEach((task) => tasksToReinsert.push(task));

    // Reconstrói o heap com todas as tarefas válidas e ativas
    tasksToReinsert.forEach((task) => {
      if (task.isActive) {
        // dupla checagem caso uma tarefa tenha se tornado inativa durante a execução
        this.executionHeap.push(task.toHeapItem());
      }
    });

    // Ordena as tarefas prontas por prioridade para execução
    readyTasks.sort((a, b) => b.priority - a.priority);

    const availableSlots = this.maxConcurrent - this.currentlyExecuting.size;
    const tasksToExecute = readyTasks.slice(0, availableSlots);

    // Dispara a execução (sem await, para rodar em paralelo)
    for (const task of tasksToExecute) {
      this._executeTask(task);
    }

    // A limpeza de tarefas inativas do mapa `this.tasks` ainda é útil.
    this._cleanupInactiveTasks();
  }

  /**
   * Executa tarefa individual e atualiza heap automaticamente
   * Gerencia concorrência e estatísticas de execução
   * @private
   * @async
   * @param {ScheduledTask} task - Tarefa a ser executada
   */
  async _executeTask(task) {
    if (this.currentlyExecuting.has(task.id)) return;
    this.currentlyExecuting.add(task.id);
    const startTime = Date.now();
    try {
      await task.execute();
      this._updateStats(Date.now() - startTime, false);
    } catch (error) {
      this._updateStats(Date.now() - startTime, true);
      this.logger.error(`Erro em '${task.id}':`, error);
    } finally {
      this.currentlyExecuting.delete(task.id);
    }
  }

  /**
   * Remove automaticamente tarefas inativas da fila
   * Melhora performance removendo tarefas que não executarão mais
   * @private
   */
  _cleanupInactiveTasks() {
    // Encontra todas as tarefas inativas
    const inactiveTasks = Array.from(this.tasks.entries()).filter(
      ([_, task]) => !task.isActive
    );

    // Remove cada tarefa inativa
    for (const [id, _] of inactiveTasks) {
      this.removeTask(id);
    }
  }

  /**
   * Atualiza estatísticas de execução com novos dados
   * Mantém histórico limitado para cálculo de médias
   * @private
   * @param {number} executionTime - Tempo de execução em milissegundos
   * @param {boolean} wasError - Se a execução resultou em erro
   */
  _updateStats(executionTime, wasError) {
    // Incrementa contadores totais
    this.stats.totalExecutions++;
    if (wasError) this.stats.totalErrors++;

    // Adiciona tempo ao histórico
    this.stats.executionTimes.push(executionTime);

    // Mantém apenas últimos 100 tempos para performance
    if (this.stats.executionTimes.length > 100) {
      this.stats.executionTimes.shift();
    }

    // Recalcula média com dados atuais
    this.stats.avgExecutionTime =
      this.stats.executionTimes.reduce((a, b) => a + b, 0) /
      this.stats.executionTimes.length;
  }

  // ==========================================
  //          AUXILIARES PARA MÉTRICAS
  // ==========================================

  /**
   * Formata uptime em formato legível
   * @private
   * @param {number} ms - Tempo em milissegundos
   * @returns {string} Tempo formatado
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  /**
   * Calcula estatísticas de tempo de execução
   * @private
   * @returns {Object} Estatísticas de tempo
   */
  _calculateExecutionTimeStats() {
    if (this.stats.executionTimes.length === 0) {
      return { min: 0, max: 0, median: 0, p95: 0 };
    }

    const sorted = [...this.stats.executionTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const medianIndex = Math.floor(sorted.length / 2);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[medianIndex],
      p95: sorted[p95Index],
    };
  }

  /**
   * Calcula status geral de saúde
   * @private
   * @returns {string} Status de saúde
   */
  _calculateHealthStatus() {
    const errorRate =
      this.stats.totalExecutions > 0
        ? (this.stats.totalErrors / this.stats.totalExecutions) * 100
        : 0;

    const heapLeak = this.executionHeap.size() > this.tasks.size * 3;

    if (heapLeak) return '🔴 CRÍTICO';
    if (errorRate > 10) return '🟡 ATENÇÃO';
    if (errorRate > 0) return '🟢 ESTÁVEL';
    return '✅ SAUDÁVEL';
  }

  /**
   * Gera alertas de saúde do sistema
   * @private
   * @returns {string[]} Array de alertas
   */
  _generateHealthAlerts() {
    const alerts = [];

    // Alerta de vazamento de heap
    if (this.executionHeap.size() > this.tasks.size * 3) {
      alerts.push('🚨 Possível vazamento de heap detectado');
    }

    // Alerta de alta taxa de erro
    const errorRate =
      this.stats.totalExecutions > 0
        ? (this.stats.totalErrors / this.stats.totalExecutions) * 100
        : 0;
    if (errorRate > 10) {
      alerts.push(`⚠️ Alta taxa de erro: ${errorRate.toFixed(2)}%`);
    }

    // Alerta de tarefas travadas
    if (this.currentlyExecuting.size >= this.maxConcurrent) {
      alerts.push('⏸️ Todos os slots de concorrência ocupados');
    }

    // Alerta de muitas tarefas pausadas
    const pausedCount = Array.from(this.tasks.values()).filter(
      (t) => t.isPaused
    ).length;
    if (pausedCount > 0) {
      alerts.push(`⏸️ ${pausedCount} tarefa(s) pausada(s)`);
    }

    return alerts;
  }

  /**
   * Analisa distribuição de prioridades
   * @private
   * @returns {Object} Distribuição de prioridades
   */
  _analyzePriorityDistribution() {
    const distribution = {};

    Array.from(this.tasks.values()).forEach((task) => {
      const priority = task.priority || 0;
      distribution[priority] = (distribution[priority] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Estima o intervalo médio de execução com base no tempo total de atividade
   * @private
   * @returns {number} Tempo médio em ms
   */
  _calculateExecutionIntervalEstimate() {
    if (this.stats.totalExecutions <= 1) return 0;

    const uptime = this.stats.queueStartTime
      ? Date.now() - this.stats.queueStartTime
      : 0;

    return uptime / this.stats.totalExecutions;
  }

  /**
   * Detecta tarefas problemáticas
   * @private
   * @returns {Object[]} Array de tarefas problemáticas
   */
  _detectProblematicTasks() {
    const problematic = [];

    Array.from(this.tasks.values()).forEach((task) => {
      const issues = [];

      // Tarefa não executou há muito tempo
      if (
        task.lastExecution &&
        Date.now() - task.lastExecution > task.interval * 3
      ) {
        issues.push('Não executou há muito tempo');
      }

      // Tarefa com muitos erros
      if (task.errorCount > 5) {
        issues.push(`${task.errorCount} erros consecutivos`);
      }

      // Tarefa pausada há muito tempo
      if (
        task.isPaused &&
        task.pausedAt &&
        Date.now() - task.pausedAt > 300000
      ) {
        issues.push('Pausada há mais de 5 minutos');
      }

      if (issues.length > 0) {
        problematic.push({
          id: task.id,
          issues: issues,
          priority: task.priority,
        });
      }
    });

    return problematic;
  }

  /**
   * Calcula eficiência do debounce
   * @private
   * @returns {string} Eficiência formatada
   */
  _calculateDebounceEfficiency() {
    const total =
      this.stats.totalExecutions + this.stats.totalSkippedByDebounce;
    return total > 0
      ? ((this.stats.totalSkippedByDebounce / total) * 100).toFixed(2) + '%'
      : '0%';
  }

  /**
   * Formata tempo relativo
   * @private
   * @param {number} ms - Tempo em milissegundos
   * @returns {string} Tempo formatado
   */
  _formatRelativeTime(ms) {
    if (ms < 60000) return `${Math.floor(ms / 1000)}s atrás`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m atrás`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h atrás`;
    return `${Math.floor(ms / 86400000)}d atrás`;
  }

  /**
   * Obtém status da tarefa
   * @private
   * @param {ScheduledTask} task - Tarefa a analisar
   * @returns {string} Status da tarefa
   */
  _getTaskStatus(task) {
    if (!task.isActive) return '❌ Inativa';
    if (task.isPaused) return '⏸️ Pausada';
    if (this.currentlyExecuting.has(task.id)) return '⚡ Executando';
    if (task.debouncer && !task.debouncer.canCall()) return '⏳ Debounce';
    return '✅ Pronta';
  }

  /**
   * Obtém tempo restante de debounce
   * @private
   * @param {ScheduledTask} task - Tarefa a analisar
   * @returns {string} Tempo restante
   */
  _getDebounceTimeRemaining(task) {
    if (!task.debouncer || task.debouncer.canCall()) return '0ms';

    const remaining =
      task.debounceTime || 0 - (Date.now() - task.debouncer.lastCall);
    return remaining > 0 ? `${remaining}ms` : '0ms';
  }
}

module.exports = TaskQueue;
