const ScheduledTask = require('../taskQueue/ScheduledTask.js');
/**
 * @typedef {Object} TaskOptions
 * @property {number} [priority=0] - Prioridade da tarefa (maior valor = maior prioridade)
 * @property {boolean} [paused=false] - Se a tarefa está pausada
 * @property {number} [maxExecutions=Infinity] - Número máximo de execuções permitidas
 * @property {ErrorHandler} [onError=null] - Callback para tratamento de erros
 * @property {Object} [context=null] - Contexto (this) para execução da função
 * @property {number} [debounce=null] - Tempo de debounce em milissegundos
 */

/**
 * @typedef {Object} TaskStatus
 * @property {string} id - Identificador único da tarefa
 * @property {boolean} isActive - Se a tarefa está ativa
 * @property {number} executionCount - Número de execuções realizadas
 * @property {number} nextExecutionIn - Tempo em ms até próxima execução
 * @property {number} priority - Prioridade da tarefa
 * @property {Object} debounce - Informações sobre debounce
 * @property {boolean} debounce.enabled - Se debounce está habilitado
 * @property {number} debounce.time - Tempo de debounce configurado
 * @property {boolean} debounce.canCall - Se pode executar agora (debounce)
 */

/**
 * @typedef {Object} QueueStats
 * @property {number} totalExecutions - Total de execuções realizadas
 * @property {number} totalErrors - Total de erros ocorridos
 * @property {number} totalSkippedByDebounce - Total de execuções puladas por debounce
 * @property {number|null} queueStartTime - Timestamp de início da fila
 * @property {number|null} queueStopTime - Timestamp de parada da fila
 * @property {number} avgExecutionTime - Tempo médio de execução em ms
 * @property {number[]} executionTimes - Array dos últimos tempos de execução
 * @property {string} debounceEfficiency - Porcentagem de eficiência do debounce
 */

/**
 * @typedef {Object} QueueStatus
 * @property {boolean} isRunning - Se a fila está em execução
 * @property {number} totalTasks - Total de tarefas na fila
 * @property {number} activeTasks - Número de tarefas ativas
 * @property {number} currentlyExecuting - Número de tarefas executando agora
 * @property {number|null} nextExecutionIn - Tempo até próxima execução em ms
 * @property {number} heapSize - Tamanho atual do heap
 * @property {QueueStats} stats - Estatísticas detalhadas
 * @property {TaskStatus[]} taskDetails - Detalhes de todas as tarefas
 */

/**
 * @typedef {Object} HeapItem
 * @property {string} key - Chave identificadora (ID da tarefa)
 * @property {number} expiresAt - Timestamp de quando deve ser executada
 */

/**
 * @typedef {Object} QueueOptions
 * @property {number} [minTickInterval=100] - Intervalo mínimo entre verificações em ms
 * @property {number} [maxConcurrent=1] - Máximo de tarefas executando simultaneamente
 * @property {Object} [logger=console] - Objeto para logging (deve ter métodos info, warn, error, debug)
 */

/**
 * @callback TaskFunction
 * @returns {Promise<any>|any} Resultado da execução da tarefa
 */

/**
 * @callback ErrorHandler
 * @param {Error} error - Erro que ocorreu durante a execução
 * @param {ScheduledTask} task - Instância da tarefa que gerou o erro
 */

module.exports = {}