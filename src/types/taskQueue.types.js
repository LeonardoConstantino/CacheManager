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
 * @property {number|null} nextExecutionIn - Tempo em ms até próxima execução
 * @property {number} priority - Prioridade da tarefa
 * @property {Object} debounce - Informações sobre debounce
 * @property {boolean} debounce.enabled - Se debounce está habilitado
 * @property {number} debounce.time - Tempo de debounce configurado
 * @property {boolean} debounce.canCall - Se pode executar agora (debounce)
 */

/**
 * @typedef {Object} ExecutionTimeStats
 * @property {number} min - Tempo mínimo de execução em milissegundos
 * @property {number} max - Tempo máximo de execução em milissegundos
 * @property {number} median - Tempo mediano de execução em milissegundos
 * @property {number} average - Tempo médio de execução em milissegundos
 */

/**
 * @typedef {Object} PriorityDistribution
 * @property {number} high - Quantidade de tarefas com prioridade alta
 * @property {number} medium - Quantidade de tarefas com prioridade média
 * @property {number} low - Quantidade de tarefas com prioridade baixa
 * @property {Object} custom - Distribuição de prioridades customizadas
 */

/**
 * @typedef {Object} QueueStatus
 * @property {boolean} isRunning - Indica se a fila está em execução
 * @property {number} totalTasks - Total de tarefas na fila
 * @property {number} totalExecutions - Total de execuções realizadas
 * @property {number} totalErrors - Total de erros ocorridos durante execuções
 * @property {number} activeTasks - Número de tarefas ativas
 * @property {number} currentlyExecuting - Número de tarefas executando atualmente
 * @property {number|null} nextExecutionIn - Tempo até próxima execução em ms
 * @property {number} heapSize - Tamanho atual do heap de execução
 * @property {number} pausedTasks - Total de tarefas pausadas
 * @property {string} uptime - Tempo de atividade da fila formatado
 * @property {number} uptimeMs - Tempo de atividade em milissegundos
 * @property {string} heapEfficiency - Eficiência do heap em percentual
 * @property {string} errorRate - Taxa de erro em percentual
 * @property {string} executionsPerMinute - Execuções por minuto
 * @property {number} avgTimeBetweenExecutions - Tempo médio entre execuções em ms
 * @property {PerformanceMetrics} performance - Métricas detalhadas de performance
 * @property {number} totalSkippedByDebounce - Total de execuções puladas por debounce
 * @property {number|null} queueStartTime - Timestamp de quando a fila foi iniciada
 * @property {number|null} queueStopTime - Timestamp de quando a fila foi parada
 * @property {number} avgExecutionTime - Tempo médio de execução das tarefas em ms
 * @property {number[]} executionTimes - Array com os últimos tempos de execução (máx 100)
 * @property {string} debounceEfficiency - Porcentagem de eficiência do mecanismo de debounce
 */

/**
 * @typedef {Object} ProblematicTask
 * @property {string} id - Identificador único da tarefa
 * @property {string} issue - Descrição do problema identificado
 * @property {number} duration - Duração do problema em milissegundos
 * @property {string} severity - Severidade do problema (low, medium, high, critical)
 */

/**
 * @typedef {Object} TaskDebounceInfo
 * @property {boolean} enabled - Se o debounce está habilitado para a tarefa
 * @property {number} time - Tempo de debounce em milissegundos
 * @property {boolean} canCall - Se a tarefa pode ser executada no momento
 * @property {string} timeRemaining - Tempo restante de debounce formatado
 */

/**
 * @typedef {Object} TaskDetail
 * @property {string} id - Identificador único da tarefa
 * @property {boolean} isActive - Se a tarefa está ativa
 * @property {boolean} isPaused - Se a tarefa está pausada
 * @property {number} executionCount - Número total de execuções da tarefa
 * @property {number|null} nextExecutionIn - Tempo até a próxima execução em milissegundos
 * @property {number} priority - Prioridade da tarefa (1-10)
 * @property {string} lastExecution - Tempo da última execução formatado
 * @property {string} executionFrequency - Frequência de execução por minuto
 * @property {string} status - Status atual da tarefa
 * @property {TaskDebounceInfo} debounce - Informações sobre debounce da tarefa
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} availableConcurrencySlots - Slots de concorrência disponíveis
 * @property {string} concurrencyUtilization - Utilização da concorrência em percentual
 * @property {ExecutionTimeStats} executionTimeStats - Estatísticas de tempo de execução
 * @property {string} throughput - Throughput em tarefas por segundo
 * @property {PriorityDistribution} priorityDistribution - Distribuição de prioridades
 */

/**
 * @typedef {Object} HealthMetrics
 * @property {string} status - Status geral da fila (healthy, warning, critical)
 * @property {boolean} possibleHeapLeak - Se há possível vazamento de heap
 * @property {boolean} hasStuckTasks - Se há tarefas travadas
 * @property {string[]} alerts - Lista de alertas detectados
 * @property {ProblematicTask[]} problematicTasks - Lista de tarefas problemáticas
 */

/**
 * @typedef {Object} DebounceMetrics
 * @property {number} tasksWithDebounce - Total de tarefas com debounce
 * @property {string} debounceEfficiency - Eficiência do debounce em percentual
 * @property {number} executionsSaved - Economia de execuções pelo debounce
 */

/**
 * @typedef {Object} EnhancedStats
 * @property {number} totalExecutions - Total de execuções realizadas
 * @property {number} totalSkippedByDebounce - Total de execuções ignoradas pelo debounce
 * @property {number} totalErrors - Total de erros ocorridos
 * @property {string} debounceEfficiency - Eficiência do debounce calculada
 */

/**
 * @typedef {Object} TaskQueueMetrics
 * @property {boolean} isRunning - Se a fila está em execução
 * @property {number} totalTasks - Total de tarefas na fila
 * @property {number} activeTasks - Número de tarefas ativas
 * @property {number} currentlyExecuting - Número de tarefas em execução
 * @property {number|null} nextExecutionIn - Tempo até a próxima execução em milissegundos
 * @property {number} heapSize - Tamanho atual do heap de execução
 * @property {number} pausedTasks - Total de tarefas pausadas
 * @property {string} uptime - Tempo que a fila está ativa (formato legível)
 * @property {number} uptimeMs - Uptime em milissegundos
 * @property {string} heapEfficiency - Eficiência do heap em percentual
 * @property {string} errorRate - Taxa de erro percentual
 * @property {string} executionsPerMinute - Execuções por minuto
 * @property {number} avgTimeBetweenExecutions - Tempo médio entre execuções em ms
 * @property {PerformanceMetrics} performance - Métricas de performance
 * @property {HealthMetrics} health - Métricas de saúde do sistema
 * @property {DebounceMetrics} debounceMetrics - Métricas de debounce
 * @property {EnhancedStats} stats - Estatísticas aprimoradas
 * @property {TaskDetail[]} taskDetails - Detalhes das tarefas com métricas adicionais
 */

/**
 * @typedef {Object} HeapItem
 * @property {string} key - Chave identificadora (ID da tarefa)
 * @property {number} expiresAt - Timestamp de quando deve ser executada
 */

/**
 * @typedef {Object} QueueOptions
 * @property {number} [minTickInterval=100] - Intervalo mínimo entre verificações em ms
 * @property {number} [maxTickInterval=5000] - Intervalo máximo entre verificações em ms
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