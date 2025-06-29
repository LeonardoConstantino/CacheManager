/**
 * @typedef {import('../types/cache.types.js').CacheInterface} CacheForPersistence
 * @typedef {import('../types/cache.types.js').MyCacheMemoryStats} MyCacheMemoryStats
 */

const {MinimalPersistence} = require('./MinimalPersistence.js');
const Logger = require('../logger/Logger.js');
const { logStyles } = require('../utils/log.js');
const { getGlobalTaskQueue } = require('../taskQueue/index.js');
const globalQueue = getGlobalTaskQueue({
  logger: new Logger(logStyles.magenta('[OptimizedQueue]')),
});

/**
 * @class PersistentCache
 * @description Extensão de um sistema de cache existente com capacidades de persistência.
 * Carrega dados na inicialização e pode salvar automaticamente em intervalos regulares.
 */
class PersistentCache {
  /** @type {CacheForPersistence} */
  #cache;
  /** @type {MinimalPersistence} */
  #persistence;
  /** @type {boolean} */
  #autoSave;
  /** @type {NodeJS.Timeout | null} */
  #saveInterval;

  /**
   * @private
   * @type {object}
   * @description Classe de log personalizadas para diferentes níveis de log.
   */
  _logger;

  /**
   * Cria uma instância de PersistentCache.
   * @param {CacheForPersistence} cache - A instância do cache base (ex: Cache).
   * @param {string} storageKey - A chave de armazenamento para a persistência.
   * @param {number|null} [autoSaveInterval=null] - O intervalo em milissegundos para auto-salvar o cache.
   * Se `null`, o auto-save é desativado.
   */
  constructor(cache, storageKey, autoSaveInterval = null) {
    this._logger = new Logger('PersistentCache'); // Inicializa uma nova instancia de log.
    this._logger.info('Initialized...');
    this.#cache = cache;
    this.#persistence = new MinimalPersistence(storageKey);
    this.#autoSave = autoSaveInterval !== null;
    this.#saveInterval = null;

    // Carrega dados existentes na inicialização
    this.load();

    // Configura auto-save se especificado
    if (this.#autoSave && typeof autoSaveInterval === 'number') {
      // Verifica se o intervalo é um número válido antes de configurar o setInterval
      // this.#saveInterval = setInterval(() => {
      //   this.save();
      // }, autoSaveInterval);
      globalQueue.addTask(
        `saveCache-${storageKey}`,
        () => {
          this.save();
        },
        autoSaveInterval,
        { priority: 1, debounce: 3000 }
      );
    }
  }

  /**
   * Salva o estado atual do cache para o armazenamento persistente.
   * Inclui timestamp, entradas do cache e estatísticas.
   * @returns {boolean} `true` se a operação foi bem-sucedida, `false` caso contrário.
   */
  save(ignoreDebounce = false) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        entries: this._serializeCacheEntries(),
        stats: this.#cache.getStats(),
      };

      return this.#persistence.save(cacheData, ignoreDebounce);
    } catch (error) {
      this._logger.error('Erro ao salvar cache:', error.message);
      return false;
    }
  }

  /**
   * Carrega o estado do cache do armazenamento persistente e restaura as entradas válidas.
   * Entradas expiradas são ignoradas.
   * @returns {boolean} `true` se os dados foram carregados e restaurados, `false` caso contrário.
   */
  load() {
    try {
      const data = this.#persistence.load();
      if (!data || !data.entries) return false;

      // Limpa cache atual
      this.#cache.clear();

      // Restaura entradas válidas (não expiradas)
      const now = Date.now();
      let restoredCount = 0;

      for (const [key, item] of Object.entries(data.entries)) {
        if (now <= item.expiresAt) {
          // Calcula TTL restante
          const remainingTTL = item.expiresAt - now;
          this.#cache.set(key, item.value, remainingTTL);
          restoredCount++;
        }
      }

      this._logger.custom(
        `Cache restaurado: ${restoredCount} itens válidos`,
        (text) => `${restoredCount > 0 ? '✅' : '❗'} ${logStyles.subtle(text)}`
      );
      return true;
    } catch (error) {
      this._logger.error('Erro ao carregar cache:', error.message);
      return false;
    }
  }

  /**
   * Remove todos os dados persistidos do armazenamento.
   * @returns {boolean} `true` se a operação foi bem-sucedida, `false` caso contrário.
   */
  clearPersistence() {
    return this.#persistence.clear();
  }

  /**
   * Verifica se existem dados persistidos para este cache.
   * @returns {boolean} `true` se existem dados persistidos, `false` caso contrário.
   */
  hasPersistentData() {
    return this.#persistence.exists();
  }

  // --- Métodos proxy para o cache original ---

  /**
   * Adiciona ou atualiza um item no cache, com um TTL opcional.
   * Se o auto-save não estiver habilitado, salva o cache imediatamente após a operação.
   * @param {string} key - A chave do item.
   * @param {*} value - O valor do item.
   * @param {number|null} [ttl=null] - O tempo de vida (Time-To-Live) do item em milissegundos.
   * @returns {boolean} O resultado da operação `set` do cache base.
   */
  set(key, value, ttl=null) {
    // Armazena o resultado da operação set do cache
    const result = this.#cache.set(key, value, ttl);
    // Salva imediatamente em operações críticas se não há auto-save
    if (!this.#autoSave) {
      this.save();
    }
    // Garante que o retorno seja sempre booleano
    return result === undefined ? true : result;
  }

  /**
   * Obtém um item do cache.
   * @param {string} key - A chave do item.
   * @returns {*} O valor do item, ou `null`/`undefined` se não encontrado ou expirado.
   */
  get(key) {
    return this.#cache.get(key);
  }

  /**
   * Verifica se o cache contém uma chave específica.
   * @param {string} key - A chave a ser verificada.
   * @returns {boolean} `true` se a chave existe no cache, `false` caso contrário.
   */
  has(key) {
    return this.#cache.has(key);
  }

  /**
   * Remove um item do cache.
   * Se o auto-save não estiver habilitado, salva o cache imediatamente após a operação.
   * @param {string} key - A chave do item a ser removido.
   * @returns {boolean} O resultado da operação `delete` do cache base.
   */
  delete(key) {
    const result = this.#cache.delete(key);
    if (!this.#autoSave) {
      this.save();
    }
    return result;
  }

  /**
   * Realiza uma limpeza do cache, removendo todos os itens que expiraram.
   * Utiliza o heap de expiração para remover eficientemente os itens mais antigos.
   * @returns {number} O número de itens que foram limpos (removidos por expiração).
   */
  cleanup() {
    return this.#cache.cleanup();
  }

  /**
   * Limpa todo o cache.
   * Se o auto-save não estiver habilitado, salva o cache imediatamente após a operação.
   */
  clear() {
    this.#cache.clear();
    if (!this.#autoSave) {
      this.save();
    }
  }

  /**
   * Retorna o número de itens atualmente no cache.
   * @returns {number} O tamanho do cache.
   */
  size() {
    return this.#cache.size();
  }

  /**
   * Retorna um iterador sobre as chaves de todos os itens no cache.
   * @returns {string[]} Um iterador de chaves.
   */
  keys() {
    return this.#cache.keys();
  }

  /**
   * Obtém o tempo de vida restante (TTL) de um item específico no cache.
   * @param {string} key - A chave do item cujo TTL será recuperado.
   * @returns {number|null} O tempo de vida restante em milissegundos, ou `null` se o item não existir ou já tiver expirado.
   */
  getTTL(key) {
    return this.#cache.getTTL(key);
  }

  /**
   * Atualiza o TTL (Tempo de Vida) de um item existente no cache.
   * Se a chave não for encontrada ou o item já tiver expirado, a operação falha.
   * @param {string} key - A chave do item cujo TTL será atualizado.
   * @param {number} ttl - O novo tempo de vida em milissegundos.
   * @returns {boolean} `true` se o TTL foi atualizado com sucesso; `false` caso contrário.
   * @throws {Error} Se a chave ou o TTL forem inválidos.
   */
  updateTTL(key, ttl) {
    return this.#cache.updateTTL(key, ttl);
  }

  /**
   * Retorna as estatísticas do cache subjacente, se disponível.
   * @returns {object} As estatísticas do cache.
   */
  getStats() {
    return this.#cache.getStats();
  }

  /**
   * Retorna estatísticas aproximadas de uso de memória do cache.
   * Calcula o tamanho estimado dos valores armazenados (convertendo para JSON para objetos e string para primitivos).
   * @returns {MyCacheMemoryStats} Um objeto contendo estatísticas de memória.
   */
  getMemoryStats() {
    return this.#cache.getMemoryStats();
  }

  /**
   * Para o mecanismo de auto-save e limpa os recursos.
   * Salva o cache uma última vez se o auto-save estiver habilitado.
   */
  destroy() {
    if (this.#saveInterval) {
      // clearInterval(this.#saveInterval);
      globalQueue.removeTask('saveCache');
      this.#saveInterval = null;
    }
    
    this.clear()
  }

  /**
   * Obtém um mapa que armazena as entradas reais do cache
   * @returns {Map<string, Object>} Mapa onde a chave é a string e o valor é um objeto contendo o valor real, `expiresAt`, `accessCount` e `createdAt`.
   */
  entries() {
    return this.#cache.entries();
  }

  // --- Métodos privados ---

  /**
   * Serializa as entradas do cache, incluindo seus valores e metadados de expiração.
   * Este método assume que o cache base tem uma forma de expor os metadados de expiração (e.g., via `_entries`).
   * @private
   * @returns {Object.<string, {value: *, expiresAt: number, createdAt: number}>} Um objeto com as entradas serializadas do cache.
   */
  _serializeCacheEntries() {
    // Inicializa o objeto de entradas
    /**
     * Inicializa um objeto vazio para armazenar as entradas do cache.
     * Será usado para serializar as entradas do cache com suas respectivas informações.
     * @type {Object.<string, *>}
     */
    const entries = {};
    const keys = this.#cache.keys();

    for (const key of keys) {
      const item = this.#cache.get(key);
      if (item !== null) {
        // Reconstrói objeto com informações de expiração
        const cacheEntry = this.#cache.entries()?.get?.(key);
        if (cacheEntry) {
          entries[key] = {
            value: item,
            expiresAt: cacheEntry.expiresAt,
            createdAt: cacheEntry.createdAt || Date.now(),
          };
        }
      }
    }

    return entries;
  }
}

module.exports = PersistentCache;
