/**
 * @typedef {import('../types/taskQueue.types.js').TaskFunction} TaskFunction
 * @typedef {import('../types/taskQueue.types.js').TaskOptions} TaskOptions
 * @typedef {import('../types/taskQueue.types.js').ErrorHandler} ErrorHandler
 * @typedef {import('../types/taskQueue.types.js').QueueOptions} QueueOptions
 * @typedef {import('../types/taskQueue.types.js').QueueStats} QueueStats
 * @typedef {import('../types/taskQueue.types.js').QueueStatus} QueueStatus
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

    /** @type {number} Máximo de tarefas executando simultaneamente */
    this.maxConcurrent = options.maxConcurrent || 1;

    /** @type {Set<string>} Conjunto de IDs das tarefas atualmente em execução */
    this.currentlyExecuting = new Set();

    /** @type {boolean} Flag indicando se o objeto foi destruído, prevenindo operações em estado inválido */
    this.destroyed = false;

    /** @type {QueueStats} Objeto com estatísticas detalhadas de performance */
    this.stats = {
      /** @type {number} Total de execuções realizadas */
      totalExecutions: 0,

      /** @type {number} Total de erros ocorridos durante execuções */
      totalErrors: 0,

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
   * Reconstrói heap sem o item removido (MinHeap não tem remoção nativa por key)
   * @private
   * @param {string} id - ID da tarefa a ser removida do heap
   */
  removeFromHeap(id) {
  const remainingItems = [];
  let removedCount = 0;

  // Extrai todos os itens, filtrando o que deve ser removido
  while (this.executionHeap.size() > 0) {
    const item = this.executionHeap.pop();
    
    if (!item) {
      continue;
    }
    
    if (item.key === id) {
      removedCount++;
    } else {
      remainingItems.push(item);
    }
  }

  // CORREÇÃO: Reconstrói heap apenas com itens válidos
  remainingItems
    .filter((item) => item && this.tasks.has(item.key))
    .forEach((item) => this.executionHeap.push(item));

  // Log se múltiplos itens foram removidos (indica problema)
  if (removedCount > 1) {
    this.logger.warn(`Múltiplos itens removidos do heap para tarefa '${id}': ${removedCount}`);
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
   * OTIMIZAÇÃO: Processa apenas tarefas prontas usando heap para eficiência
   * Extrai tarefas do heap, ordena por prioridade e executa respeitando concorrência
   * @private
   * @async
   */
  async _processTasks() {
    // Para processamento se não há tarefas
    if (this.tasks.size === 0) {
      this.stop();
      return;
    }

    // Extrai tarefas prontas do heap eficientemente
    const readyTasks = this._getReadyTasksFromHeap().filter(
      (task) => !task.isPaused
    );

    // Sai se nenhuma tarefa está pronta
    if (readyTasks.length === 0) {
      return; // Nenhuma tarefa pronta para execução
    }

    // Ordena tarefas por prioridade (maior prioridade primeiro)
    readyTasks.sort((a, b) => b.priority - a.priority);

    // Calcula slots disponíveis para execução baseado na concorrência
    const availableSlots = this.maxConcurrent - this.currentlyExecuting.size;
    const tasksToExecute = readyTasks.slice(0, availableSlots);

    // Executa tarefas respeitando limite de concorrência
    for (const task of tasksToExecute) {
      // Double-check de concorrência por segurança
      if (this.currentlyExecuting.size >= this.maxConcurrent) {
        break;
      }
      // Executa tarefa de forma assíncrona (não-bloqueante)
      this._executeTask(task);
    }

    // Limpeza automática de tarefas inativas
    this._cleanupInactiveTasks();
    this._cleanupOrphanedHeapItems();
  }

  /**
   * OTIMIZAÇÃO: Extrai tarefas prontas do heap eficientemente
   * Processa heap até encontrar tarefa não-pronta, mantendo ordem
   * @private
   * @returns {ScheduledTask[]} Array de tarefas prontas para execução
   */
  _getReadyTasksFromHeap() {
  const readyTasks = [];
  const currentTime = Date.now();
  const tempItems = [];

  // CORREÇÃO: Limita processamento para evitar loops infinitos
  let processedCount = 0;
  const maxProcessItems = Math.min(this.executionHeap.size(), 1000);

  while (this.executionHeap.size() > 0 && processedCount < maxProcessItems) {
    const item = this.executionHeap.peek();
    
    if (!item) {
      // CORREÇÃO: Remove item nulo/inválido
      this.executionHeap.pop();
      processedCount++;
      continue;
    }

    // Se item não está pronto, para a busca (heap está ordenado)
    if (item.expiresAt > currentTime) {
      break;
    }

    // Remove item do heap
    const heapItem = this.executionHeap.pop();
    processedCount++;

    if (!heapItem) continue;

    // CORREÇÃO: Verifica se tarefa ainda existe antes de processar
    const task = this.tasks.get(heapItem.key);
    
    if (!task) {
      // CORREÇÃO: Item órfão detectado - não reinsere no heap
      this.logger.debug(`Item órfão removido do heap: ${heapItem.key}`);
      continue;
    }

    // CORREÇÃO: Verifica se tarefa está realmente ativa
    if (!task.isActive) {
      // CORREÇÃO: Tarefa inativa - não reinsere no heap
      this.logger.debug(`Tarefa inativa removida do heap: ${task.id}`);
      continue;
    }

    // Verifica se deve executar (inclui debounce)
    if (task.shouldExecute()) {
      readyTasks.push(task);
    } else {
      // Tarefa bloqueada por debounce
      this.stats.totalSkippedByDebounce++;
      this.logger.debug(`Tarefa '${task.id}' pulada por debounce`);
    }

    // CORREÇÃO: Re-agenda apenas se tarefa ainda está ativa
    if (task.isActive) {
      tempItems.push(task.toHeapItem());
    }
  }

  // Reinsere apenas itens válidos no heap
  tempItems.forEach((item) => {
    if (item && this.tasks.has(item.key)) {
      this.executionHeap.push(item);
    }
  });

  return readyTasks;
}

  /**
   * Executa tarefa individual e atualiza heap automaticamente
   * Gerencia concorrência e estatísticas de execução
   * @private
   * @async
   * @param {ScheduledTask} task - Tarefa a ser executada
   */
  async _executeTask(task) {
    // Previne execução duplicada da mesma tarefa
    if (this.currentlyExecuting.has(task.id)) {
      return;
    }

    // Marca tarefa como executando e registra timestamp inicial
    this.currentlyExecuting.add(task.id);
    const startTime = Date.now();

    try {
      this.logger.debug(`Executando '${task.id}'`);

      // Executa a tarefa assincronamente
      await task.execute();

      // Calcula tempo de execução para estatísticas
      const executionTime = Date.now() - startTime;
      this._updateStats(executionTime, false);

      // OTIMIZAÇÃO: Re-adiciona ao heap se ainda ativa
      if (task.isActive) {
        this.executionHeap.push(task.toHeapItem());
      }

      this.logger.debug(
        `'${task.id}' concluída (${executionTime}ms)`
      );
    } catch (error) {
      // Calcula tempo mesmo em caso de erro
      const executionTime = Date.now() - startTime;
      this._updateStats(executionTime, true);

      // Re-adiciona mesmo com erro se ainda ativa
      if (task.isActive) {
        this.executionHeap.push(task.toHeapItem());
      }

      this.logger.error(`Erro em '${task.id}':`, error);
    } finally {
      // Remove da lista de execução em qualquer caso
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

  /**
   * Retorna status completo e otimizado com informações do heap
   * Fornece visão detalhada do estado atual da fila
   * @returns {QueueStatus} Objeto com status completo da fila
   * @example
   * const status = queue.getStatus();
   * console.log(`Executando: ${status.currentlyExecuting}/${status.maxConcurrent}`);
   * console.log(`Próxima execução em: ${status.nextExecutionIn}ms`);
   */
  getStatus() {
    // Filtra apenas tarefas ativas para contagem
    const activeTasks = Array.from(this.tasks.values()).filter(
      (t) => t.isActive
    );

    // Calcula tempo até próxima execução baseado no heap
    // Verifica se o heap existe e tem tamanho maior que zero antes de acessar
    const nextExecution =
      this.executionHeap && this.executionHeap.size() > 0
        ? Math.max(0, this.executionHeap.peek()?.expiresAt || 0 - Date.now())
        : null;

    return {
      /** @type {boolean} Se a fila está processando */
      isRunning: this.isRunning,

      /** @type {number} Total de tarefas na fila */
      totalTasks: this.tasks.size,

      /** @type {number} Número de tarefas ativas */
      activeTasks: activeTasks.length,

      /** @type {number} Tarefas executando no momento */
      currentlyExecuting: this.currentlyExecuting.size,

      /** @type {number|null} Tempo até próxima execução em ms */
      nextExecutionIn: nextExecution,

      /** @type {number} NOVA métrica - Tamanho atual do heap */
      heapSize: this.executionHeap?.size() || 0,

      /** @type {QueueStats} Estatísticas detalhadas com eficiência de debounce */
      stats: {
        ...this.stats,
        /** @type {string} Porcentagem de eficiência do debounce */
        debounceEfficiency:
          this.stats.totalExecutions > 0
            ? (
                (this.stats.totalSkippedByDebounce /
                  this.stats.totalExecutions) *
                100
              ).toFixed(2) + '%'
            : '0%',
      },

      /** @type {TaskStatus[]} Detalhes completos de todas as tarefas */
      taskDetails: Array.from(this.tasks.values()).map((task) => ({
        /** @type {string} ID da tarefa */
        id: task.id,

        /** @type {boolean} Se a tarefa está ativa */
        isActive: task.isActive,

        /** @type {number} Número de execuções realizadas */
        executionCount: task.executionCount,

        /** @type {number} Tempo até próxima execução em ms */
        nextExecutionIn: task.timeUntilNext(),

        /** @type {number} Prioridade da tarefa */
        priority: task.priority,

        /** @type {Object} Informações detalhadas sobre debounce */
        debounce: {
          /** @type {boolean} Se debounce está habilitado */
          enabled: !!task.debouncer,

          /** @type {number} Tempo de debounce configurado */
          time: task.debounceTime ?? 0,

          /** @type {boolean} Se pode executar agora (não bloqueado) */
          canCall: task.debouncer ? task.debouncer.canCall() : true,
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

  /**
 * CORREÇÃO: Limpa itens órfãos do heap que não correspondem a tarefas ativas
 * Previne vazamento de memória no heap
 * @private
 */
_cleanupOrphanedHeapItems() {
  // Executa limpeza apenas periodicamente para não impactar performance
  if (this.stats.totalExecutions % 100 !== 0) {
    return;
  }

  const validItems = [];
  const currentTime = Date.now();
  let orphanedCount = 0;

  // Processa todos os itens do heap
  while (this.executionHeap.size() > 0) {
    const item = this.executionHeap.pop();
    
    if (!item) {
      orphanedCount++;
      continue;
    }

    // Verifica se item corresponde a uma tarefa ativa
    const task = this.tasks.get(item.key);
    
    if (task && task.isActive) {
      // Item válido - mantém no heap
      validItems.push(item);
    } else {
      // Item órfão - descarta
      orphanedCount++;
    }
  }

  // Reconstrói heap apenas com itens válidos
  validItems.forEach((item) => this.executionHeap.push(item));

  // Log da limpeza se itens foram removidos
  if (orphanedCount > 0) {
    this.logger.debug(`Limpeza do heap: ${orphanedCount} itens órfãos removidos`);
  }
}
}

module.exports = TaskQueue;
