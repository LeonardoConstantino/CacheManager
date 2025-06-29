// CacheManager/src/taskQueue/index.js
/**
 * @typedef {import('../types/taskQueue.types.js').QueueOptions} QueueOptions
 */

/**
 * @module TaskQueueManager
 * @description Módulo de gerenciamento central de instâncias de TaskQueue
 * 
 * Fornece dois padrões de acesso:
 * 1. Singleton global (para estado compartilhado)
 * 2. Instâncias isoladas (para contextos independentes)
 * 
 * @see {@link ./TaskQueue} TaskQueue
 */

// Importa a classe TaskQueue do módulo local
const TaskQueue = require('./TaskQueue.js');

// Armazena a instância singleton global
let globalInstance = null;

/**
 * Retorna a instância global única do TaskQueue (padrão singleton)
 * @function getGlobalTaskQueue
 * @param {QueueOptions} [options={}] - Opções de configuração para inicialização da fila
 * @returns {TaskQueue} Instância singleton do TaskQueue
 * 
 * @example
 * // Obter instância global com configuração padrão
 * const globalQueue = getGlobalTaskQueue();
 * 
 * // Obter instância global com configuração personalizada
 * const configuredQueue = getGlobalTaskQueue({
 *   minTickInterval: 100,
 *   maxConcurrent: 1,
 *   logger: console
 * });
 */
function getGlobalTaskQueue(options = {}) {
  // Verifica se a instância global já existe
  if (!globalInstance) {
    // Cria nova instância se não existir
    globalInstance = new TaskQueue(options);
    // Inicialização adicional pode ser feita aqui
  }
  // Retorna a instância existente ou recém-criada
  return globalInstance;
}

/**
 * Cria uma nova instância isolada do TaskQueue
 * @function createNewTaskQueue
 * @param {QueueOptions} [options={}] - Opções de configuração para inicialização da fila
 * @returns {TaskQueue} Nova instância independente do TaskQueue
 * 
 * @example
 * // Criar instância isolada para operações críticas
 * const isolatedQueue = createNewTaskQueue({
 *   minTickInterval: 10,
 *   maxConcurrent: 1
 * });
 */
function createNewTaskQueue(options = {}) {
  // Cria e retorna uma nova instância independente
  return new TaskQueue(options);
}

// Exporta as funções como interface pública do módulo
module.exports = {
  getGlobalTaskQueue,
  createNewTaskQueue,
};

// EXEMPLO DE USO OTIMIZADO:
/**
 * @example <caption>Uso avançado do sistema de filas</caption>
 * // Importar gerenciador
 * const { getGlobalTaskQueue, createNewTaskQueue } = require('./taskQueue');
 * 
 * // Obter instância global
 * const globalQueue = getGlobalTaskQueue({ 
 *   minTickInterval: 50,
 *   maxConcurrent: 3
 * });
 * 
 * // Criar instância isolada
 * const isolatedQueue = createNewTaskQueue({
 *   minTickInterval: 100,
 *   maxConcurrent: 1
 * });
 * 
 * // Adicionar tarefa à fila global
 * globalQueue.addTask('fastTask', () => console.log('Executado'), 1000, {
 *   priority: 10,
 *   maxExecutions: 100
 * });
 * 
 * // Adicionar tarefa à fila isolada
 * isolatedQueue.addTask('criticalTask', () => console.log('Crítico'), 2000, {
 *   priority: 99,
 *   onError: (error) => console.error('Falha crítica:', error)
 * });
 * 
 * // Monitorar status
 * setInterval(() => {
 *   console.log('Status Global:', globalQueue.getStatus());
 *   console.log('Status Isolado:', isolatedQueue.getStatus());
 * }, 5000);
 */