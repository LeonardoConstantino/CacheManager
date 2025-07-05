/**
 * @typedef {import('../types/cache.types.js').CacheInterface} CacheInterface
 * @typedef {import('../types/cache.types.js').PersistentCache} PersistentCache
 * @typedef {import('../types/cache.types.js').CacheConfigOptions} CacheConfigOptions
 * @typedef {import('../types/cache.types.js').FreezeOption} FreezeOption
 * @typedef {import('../types/cache.types.js').HeapItem} HeapItem
 * @typedef {import('../types/cache.types.js').LRUCacheItem} LRUCacheItem
 * @typedef {import('../types/cache.types.js').LRUNodeType} LRUNodeType
 * @typedef {import('../types/cache.types.js').MyCacheStats} MyCacheStats
 * @typedef {import('../types/cache.types.js').MyCacheMemoryStats} MyCacheMemoryStats
 */

const MinHeap = require('../expiration/TTLHeap.js');
const { DoublyLinkedList, LRUNode } = require('../eviction/LRUPolicy.js');
const Logger = require('../logger/Logger.js');
const { logLevel } = require('../utils/log.js');

/**
 * Objeto contendo as opções de congelamento disponíveis
 * @enum {FreezeOption}
 * @readonly
 * @type {{
 *   DEEP: 'deep',
 *   SHALLOW: 'shallow',
 *   NONE: 'none'
 * }}
 */
const freezeOptions = Object.freeze({
  DEEP: 'deep',
  SHALLOW: 'shallow',
  NONE: 'none',
});

/**
 * @description Implementa um sistema de cache com gerenciamento de TTL (Time-To-Live) e LRU (Least Recently Used).
 * Suporta otimização de memória para objetos, congelamento profundo de valores para imutabilidade,
 * e estatísticas de uso para monitoramento.
 * @type {CacheInterface}
 */
class MyCache {
  /**
   * @private
   * @type {string}
   * @description O nome do cache.
   */
  _name;

  /**
   * @private
   * @type {number}
   * @description O tempo de vida padrão (TTL) em milissegundos para itens do cache.
   */
  _defaultTTL;

  /**
   * @private
   * @type {number}
   * @description O tamanho máximo de itens que o cache pode armazenar.
   */
  _maxSize;

  /**
   * @private
   * @type {Map<string, Object>}
   * @description Um mapa que armazena as entradas reais do cache, onde a chave é a string e o valor é um objeto contendo o valor real, `expiresAt`, `accessCount` e `createdAt`.
   */
  _entries;

  /**
   * @private
   * @type {DoublyLinkedList}
   * @description Uma lista duplamente encadeada para gerenciar a ordem de uso dos itens LRU.
   */
  _lruList;

  /**
   * @private
   * @type {Map<string, LRUNodeType>}
   * @description Um mapa que armazena referências aos nós LRU pelo nome da chave do cache para acesso rápido.
   */
  _lruNodes;

  /**
   * @private
   * @type {MinHeap}
   * @description Um heap mínimo para gerenciar a expiração dos itens, permitindo a remoção eficiente dos itens mais antigos.
   */
  _expirationHeap;

  /**
   * @private
   * @type {WeakMap<Object, Object>}
   * @description Um WeakMap para armazenar metadados de objetos complexos, como `cacheKey`, `createdAt` e `size`. Permite que os metadados sejam coletados pelo garbage collector quando o objeto não é mais referenciado.
   */
  _objectMetadata;

  /**
   * @private
   * @type {WeakMap<Object, Object>}
   * @description Um WeakMap para cachear clones de objetos. Isso otimiza o desempenho ao retornar objetos,
   * evitando clonagens repetidas do mesmo objeto se ele não foi modificado.
   */
  _cloneCache;

  /**
   * @private
   * @type {WeakSet<Object>}
   * @description Um WeakSet para rastrear objetos que já foram processados (ex: deep frozen ou com metadados adicionados),
   * otimizando operações e evitando processamento duplicado.
   */
  _processedObjects;

  /**
   * @private
   * @type {Set<string>}
   * @description Um conjunto que rastreia as chaves já utilizadas no cache, ajudando a prevenir duplicatas e gerenciar a reutilização de chaves.
   */
  _usedKeys;

  /**
   * @private
   * @type {MyCacheStats}
   * @description Objeto que armazena as estatísticas de desempenho do cache.
   */
  _stats;

  /**
   * @private
   * @type {CacheConfigOptions}
   * @description Opções de configuração para o cache, incluindo flags para LRU, limpeza automática, otimização de memória, e modo de depuração.
   */
  _options;

  /**
   * @private
   * @type {object}
   * @description Classe de log personalizadas para diferentes níveis de log.
   */
  _logger;

  /**
   * Cria uma nova instância de MyCache.
   * @param {string} name - O nome do cache.
   * @param {number} defaultTTL - O tempo de vida padrão em milissegundos para os itens do cache.
   * @param {number} maxSize - O tamanho máximo de itens que o cache pode armazenar.
   * @param {CacheConfigOptions} [options={}] - Opções de configuração adicionais para o cache.
   */
  constructor(
    name,
    defaultTTL,
    maxSize,
    options = {
      defaultTTL: defaultTTL,
      maxSize: maxSize,
      freezeOption: freezeOptions.SHALLOW,
    }
  ) {
    this._name = name;
    this._defaultTTL = defaultTTL ?? null;
    this._maxSize = maxSize;
    this._entries = new Map();
    this._lruList = new DoublyLinkedList();
    this._lruNodes = new Map();
    this._expirationHeap = new MinHeap();
    this._objectMetadata = new WeakMap(); // Metadados de objetos
    this._cloneCache = new WeakMap(); // Cache de clones
    this._processedObjects = new WeakSet(); // Objetos processados
    this._usedKeys = new Set(); // Chaves já utilizadas
    this._logger = new Logger('MyCache'); // Inicializa uma nova instancia de log.
    this._validateTTL(defaultTTL);
    this._logger.info('Inicializando...'); // Registra uma mensagem de log informando que o MyCache foi inicializado.

    // Configurações padrão mescladas com as opções fornecidas
    this._options = {
      ...options,
    };

    // Inicialização das estatísticas do cache
    this._stats = {
      name: this._name,
      size: 0,
      maxSize: this._maxSize,
      defaultTTL: this._defaultTTL,
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0, // Número de itens removidos por LRU
      cleanups: 0,
      hitRate: '0', // Taxa de acertos do cache
      objectsInCache: 0, // Número de objetos atualmente no cache
      clonesInCache: 0, // Número de clones de objetos no cache
      missesExpired: 0, // Número de itens expirados
      missesCold: 0, // Número de itens não encontrados
      evictionsTTL: 0, // Número de itens removidos por TTL
      totalSetLatencyMS: 0, // Soma de todas as Latências para armazenar itens
      maxSetLatencyMS: {
        // Latência máxima para armazenar um item
        key: '', // Chave do item com a maior latência
        latencyMS: 0, // Latência em milissegundos
      },
      avgSetLatencyMS: 0, // Latência média de armazenamento em milissegundos
      lastSetKey: '', // Chave do último item armazenado
    };
  }

  /**
   * Armazena um valor no cache. Se a chave já existir, o item existente será atualizado.
   * Se o cache atingir seu `maxSize` e não houver um item existente para a chave,
   * o item menos recentemente usado (LRU) será removido para abrir espaço.
   * O valor armazenado é profundamente congelado para garantir imutabilidade.
   * @param {string} key - A chave única para identificar o valor no cache.
   * @param {*} value - O valor a ser armazenado. Pode ser qualquer tipo de dado.
   * @param {number|null} [ttl=null] - O tempo de vida específico para este item em milissegundos.
   * Se `null` ou omitido, o `defaultTTL` do cache será usado.
   * @returns {void}
   * @throws {Error} Se a chave for inválida ou o TTL for inválido.
   */
  set(key, value, ttl = null) {
    this._logger.debug(`Setando key: ${key} com value: ${value}`);
    const timer = this._logger.Timer(key, logLevel.DEBUG, true);
    timer.start();

    this._validateKey(key);
    this._validateTTL(ttl);

    const computedTTL = ttl || this._defaultTTL;
    const expiresAt =
      computedTTL === Infinity ? Infinity : Date.now() + computedTTL;

    // Remove item existente se houver
    if (this._entries.has(key)) {
      this._removeFromLRU(key);
    }
    // Remove item mais antigo se atingir limite de tamanho
    else if (this._entries.size >= this._maxSize) {
      this._evictLRU();
    }

    const item = Object.freeze({
      value: this._deepFreeze(value),
      expiresAt,
      accessCount: 0,
      createdAt: Date.now(),
    });

    this._entries.set(key, item);
    this._usedKeys.add(key);
    this._stats.lastSetKey = key;
    // Adiciona ao heap SOMENTE se não for Infinity
    if (expiresAt !== Infinity) {
      this._addToExpirationHeap(key, expiresAt);
    }

    // Verifica se o LRU está habilitado nas opções de configuração antes de adicionar
    if (this._options?.enableLRU === true) {
      this._addToLRU(key, item);
    }

    // Verifica se a otimização fraca está habilitada e se o valor é um objeto válido
    if (
      this._options?.enableWeakOptimization === true &&
      typeof value === 'object' &&
      value !== null
    ) {
      this._objectMetadata.set(value, {
        cacheKey: key,
        createdAt: Date.now(),
        size: JSON.stringify(value).length,
      });
      this._processedObjects.add(value);
    }

    this._stats.sets++;

    const timerResult = timer.end();

    this._stats.totalSetLatencyMS += timerResult.totalDuration;

    if (timerResult.totalDuration > this._stats.maxSetLatencyMS.latencyMS) {
      this._stats.maxSetLatencyMS.key = key;
      this._stats.maxSetLatencyMS.latencyMS = timerResult.totalDuration;
    }
  }

  /**
   * Recupera um valor do cache. Se o item estiver expirado, ele é removido e `null` é retornado.
   * Se a otimização WeakMap estiver habilitada, o valor retornado será um clone otimizado (ou do cache de clones).
   * Caso contrário, será um clone profundo.
   * @param {string} key - A chave do item a ser recuperado.
   * @returns {*} O valor armazenado correspondente à chave, ou `null` se a chave não for encontrada
   * ou se o item estiver expirado.
   * @throws {Error} Se a chave for inválida.
   */
  get(key) {
    this._logger.debug(`Obtendo key: ${key}`);

    this._validateKey(key);

    // Verifica se nunca foi usada antes (é cold miss)
    const isColdMiss = !this._usedKeys.has(key);
    this._usedKeys.add(key); // marca como usada

    const item = this._entries.get(key);
    if (!item) {
      this._stats.misses++;
      if (isColdMiss) this._stats.missesCold++;
      return null;
    }

    if (this._checkItemExpiry(key, item)) {
      this._stats.misses++;
      this._stats.missesExpired++;
      return null;
    }

    // Atualiza LRU e estatísticas
    if (this._options.enableLRU) {
      this._moveToHeadLRU(key);
    }

    const updatedItem = {
      ...item,
      accessCount: item.accessCount + 1,
    };
    this._entries.set(key, Object.freeze(updatedItem));

    this._stats.hits++;

    return this._options.enableWeakOptimization
      ? this._optimizedClone(item.value)
      : this._deepClone(item.value);
  }

  /**
   * Verifica se uma chave específica existe no cache e se o item associado não expirou.
   * @param {string} key - A chave a ser verificada.
   * @returns {boolean} `true` se a chave existe e o item não expirou; `false` caso contrário.
   * @throws {Error} Se a chave for inválida.
   */
  has(key) {
    this._logger.debug(`Checando se a chave existe: ${key}`);

    this._validateKey(key);

    const item = this._entries.get(key);
    if (!item) return false;

    return !this._checkItemExpiry(key, item);
  }

  /**
   * Remove uma chave específica e seu valor do cache.
   * @param {string} key - A chave do item a ser removido.
   * @returns {boolean} `true` se o item foi encontrado e removido com sucesso; `false` caso contrário.
   * @throws {Error} Se a chave for inválida.
   */
  delete(key) {
    this._logger.debug(`Deletando key: ${key}`);
    this._validateKey(key);

    if (!this._entries.has(key)) return false;

    const item = this._entries.get(key);
    if (item && typeof item.value === 'object' && item.value !== null) {
      // WeakMap/WeakSet são limpos automaticamente, mas podemos otimizar
      if (this._cloneCache.has(item.value)) {
        // Remove clone cache se ainda existe referência
        this._cloneCache.delete(item.value);
      }
    }

    this._entries.delete(key);
    this._removeFromLRU(key);

    return true;
  }

  /**
   * Realiza uma limpeza do cache, removendo todos os itens que expiraram.
   * Utiliza o heap de expiração para remover eficientemente os itens mais antigos.
   * @returns {number} O número de itens que foram limpos (removidos por expiração).
   */
  cleanup() {
    this._logger.debug('Iniciando limpeza do cache');
    const now = Date.now();
    let cleanedCount = 0;

    // Verifica se há objetos órfãos no WeakMap (opcional - para debugging)
    if (this._options?.debugMode) {
      let orphanedObjects = 0;
      for (const [key, item] of this._entries) {
        if (typeof item.value === 'object' && item.value !== null) {
          if (!this._processedObjects.has(item.value)) {
            orphanedObjects++;
          }
        }
      }
      this._logger.info(
        `Cache ${this._name}: ${orphanedObjects} objetos órfãos detectados`
      );
    }

    // Remove itens expirados do heap
    while (this._expirationHeap.size() > 0) {
      const next = this._expirationHeap.peek();
      // Verifica se next é null antes de acessar suas propriedades
      if (!next) break;
      if (next.expiresAt > now) break;

      this._expirationHeap.pop();
      if (this._entries.has(next.key)) {
        this._entries.delete(next.key);
        this._removeFromLRU(next.key);
        cleanedCount++;
      }
    }

    this._stats.cleanups++;
    return cleanedCount;
  }

  /**
   * Limpa completamente o cache, removendo todas as entradas, listas LRU e o heap de expiração.
   * Também reinicializa os WeakMaps/WeakSets para liberar referências.
   * @returns {void}
   */
  clear() {
    this._logger.info('Limpando o cache');
    this._entries.clear(); // Limpa todas as entradas do cache.
    this._lruNodes.clear(); // Limpa o mapa de nós LRU.
    this._lruList = new DoublyLinkedList(); // Reinicializa a lista LRU.
    this._expirationHeap.clear(); // Limpa o heap de expiração.
    this._objectMetadata = new WeakMap(); // Reinicializa o WeakMap de metadados.
    this._cloneCache = new WeakMap(); // Reinicializa o WeakMap de cache de clones.
    this._processedObjects = new WeakSet(); // Reinicializa o WeakSet de objetos processados.
  }

  /**
   * Retorna o número atual de itens no cache.
   * @returns {number} O número de entradas no cache.
   */
  size() {
    this._logger.debug('Obtendo o tamanho do cache');
    return this._entries.size;
  }

  /**
   * Retorna uma lista de todas as chaves válidas (não expiradas) atualmente no cache.
   * @returns {string[]} Um array de strings contendo as chaves dos itens válidos.
   */
  keys() {
    this._logger.debug('Obtendo as chaves do cache');
    const validKeys = [];
    const now = Date.now();

    for (const [key, item] of this._entries) {
      if (now <= item.expiresAt) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Obtém o tempo de vida restante (TTL) de um item no cache.
   * @param {string} key - A chave do item cujo TTL será verificado.
   * @returns {number|null} O tempo de vida restante em milissegundos, ou `null` se o item não existir.
   * @throws {Error} Se a chave for inválida.
   */
  getTTL(key) {
    this._logger.debug(`🔍 Obtendo TTL para a chave: "${key}"`);
    this._validateKey(key);

    const item = this._entries.get(key);
    if (!item) return null;
    if (item.expiresAt === Infinity) {
      return Infinity;
    }

    return Math.max(0, item.expiresAt - Date.now());
  }

  /**
   * Atualiza o TTL (Tempo de Vida) de um item existente no cache.
   * Se a chave não for encontrada ou o item já tiver expirado, a operação falha.
   * @param {string} key - A chave do item cujo TTL será atualizado.
   * @param {number} ttl - O novo tempo de vida em milissegundos, aceita números positivos, incluindo Infinity.
   * @returns {boolean} `true` se o TTL foi atualizado com sucesso; `false` caso contrário.
   * @throws {Error} Se a chave ou o TTL forem inválidos.
   */
  updateTTL(key, ttl) {
    this._logger.debug(`Atualizando ttl para\nkey: ${key}\nttl: ${ttl}`);

    this._validateKey(key);
    this._validateTTL(ttl);

    const item = this._entries.get(key);
    if (!item || this._checkItemExpiry(key, item)) {
      return false;
    }

    const newExpiresAt = ttl === Infinity ? Infinity : Date.now() + ttl;
    const updatedItem = {
      ...item,
      expiresAt: newExpiresAt,
    };

    this._entries.set(key, Object.freeze(updatedItem));
    // Adiciona ao heap SOMENTE se não for Infinity
    if (newExpiresAt !== Infinity) {
      this._addToExpirationHeap(key, newExpiresAt);
    }

    return true;
  }

  /**
   * Retorna um objeto contendo estatísticas detalhadas sobre o uso do cache.
   * Inclui acertos, falhas, operações de set, remoções LRU, limpezas e taxas de acerto.
   * Também adiciona estatísticas relacionadas à otimização de objetos.
   * @returns {MyCacheStats} Um objeto congelado contendo as estatísticas do cache.
   */
  getStats() {
    this._logger.debug('Obtendo estatísticas do cache');
    const totalRequests = this._stats.hits + this._stats.misses;
    const hitRate =
      totalRequests > 0
        ? ((this._stats.hits / totalRequests) * 100).toFixed(2)
        : 0;

    let objectCacheStats = {
      objectsInCache: 0,
      clonesInCache: 0,
    };

    // Conta objetos no cache principal
    for (const [key, item] of this._entries) {
      if (typeof item.value === 'object' && item.value !== null) {
        objectCacheStats.objectsInCache++;
        if (this._cloneCache.has(item.value)) {
          objectCacheStats.clonesInCache++;
        }
      }
    }

    // Remove propriedades que serão definidas explicitamente para evitar duplicação
    const {
      name: statsName,
      size,
      maxSize,
      defaultTTL,
      hitRate: statsHitRate,
      ...remainingStats
    } = this._stats;

    return Object.freeze({
      name: this._name,
      size: this._entries.size,
      maxSize: this._maxSize,
      defaultTTL: this._defaultTTL,
      hitRate: `${hitRate}%`,
      ...remainingStats,
      ...objectCacheStats,
      avgSetLatencyMS:
        totalRequests > 0 ? this._stats.totalSetLatencyMS / totalRequests : 0,
    });
  }

  /**
   * Retorna estatísticas aproximadas de uso de memória do cache.
   * Calcula o tamanho estimado dos valores armazenados (convertendo para JSON para objetos e string para primitivos).
   * @returns {MyCacheMemoryStats} Um objeto contendo estatísticas de memória.
   */
  getMemoryStats() {
    this._logger.debug('Obtendo estatísticas de memória do cache');

    let totalSize = 0;
    let objectCount = 0;
    let primitiveCount = 0;

    for (const [key, item] of this._entries) {
      if (typeof item.value === 'object' && item.value !== null) {
        objectCount++;
        // Estimativa de tamanho baseada em JSON
        totalSize += JSON.stringify(item.value).length;
      } else {
        primitiveCount++;
        totalSize += String(item.value).length;
      }
    }

    return {
      totalSize,
      totalEntries: this._entries.size,
      objectEntries: objectCount,
      primitiveEntries: primitiveCount,
      estimatedSize: `~${(totalSize / 1024).toFixed(2)} KB`,
      averageEntrySize:
        this._entries.size > 0 ? Math.round(totalSize / this._entries.size) : 0,
    };
  }

  /**
   * Destrói o cache, liberando todos os recursos internos (mapas, listas, heaps).
   * Equivalente a chamar `clear()`.
   * @returns {void}
   */
  destroy() {
    this._logger.info('Destruindo o cache');
    this.clear();
  }

  /**
   * Obtém um mapa que armazena as entradas reais do cache
   * @returns {Map<string, Object>} Mapa onde a chave é a string e o valor é um objeto contendo o valor real, `expiresAt`, `accessCount` e `createdAt`.
   */
  entries() {
    return this._entries;
  }

  // --- Métodos privados ---

  /**
   * @private
   * @description Valida se a chave fornecida é uma string não vazia.
   * @param {*} key - A chave a ser validada.
   * @returns {void}
   * @throws {Error} Se a chave for inválida.
   */
  _validateKey(key) {
    this._logger.debug(`Validando key: ${key}`);
    if (typeof key !== 'string' || key.trim() === '') {
      this._logger.error('Chave deve ser uma string não vazia');
      throw new Error('Chave deve ser uma string não vazia');
    }
  }

  /**
   * @private
   * @description Valida se o TTL fornecido é um número positivo, Infinity ou null.
   */
  _validateTTL(ttl) {
    this._logger.debug(`Validando TTL: ${ttl}`);
    if (
      ttl !== null &&
      ttl !== Infinity && // Aceita Infinity
      (typeof ttl !== 'number' || ttl < 0 || !Number.isFinite(ttl))
    ) {
      this._logger.error('TTL deve ser um número positivo, Infinity ou null');
      throw new Error('TTL deve ser um número positivo, Infinity ou null');
    }
  }

  /**
   * @private
   * @description Verifica se um item do cache expirou. Se sim, remove-o do cache e das estruturas LRU.
   * @param {string} key - A chave do item.
   * @param {Object} item - O objeto do item do cache contendo `expiresAt`.
   * @returns {boolean} `true` se o item expirou e foi removido; `false` caso contrário.
   */
  _checkItemExpiry(key, item) {
    this._logger.debug(`Checando itens inspirados para key: ${key}`);
    // Itens com Infinity nunca expiram
    if (item.expiresAt === Infinity) {
      return false;
    }
    if (Date.now() > item.expiresAt) {
      this._entries.delete(key);
      this._removeFromLRU(key);
      this._stats.evictionsTTL++;
      return true;
    }
    return false;
  }

  /**
   * @private
   * @description Remove o item menos recentemente usado (LRU) do cache, se a política LRU estiver habilitada
   * e o cache não estiver vazio. Incrementa o contador de `evictions`.
   * @returns {void}
   */
  _evictLRU() {
    this._logger.debug('Removendo item menos recentemente usado (LRU)');
    // Só prossegue se LRU estiver habilitado e houver itens no cache.
    if (!this._options.enableLRU || this._entries.size === 0) return;
    this._logger.debug('LRU está habilitado e há itens no cache');

    const oldestNode = this._lruList.removeTail();
    if (oldestNode) {
      this._entries.delete(oldestNode.key);
      this._lruNodes.delete(oldestNode.key);
      this._stats.evictions++;
    }
  }

  /**
   * @private
   * @description Adiciona um novo nó à cabeça da lista LRU e armazena sua referência no mapa de nós LRU.
   * @param {string} key - A chave do item do cache.
   * @param {Object} item - O objeto do item do cache.
   * @returns {void}
   */
  _addToLRU(key, item) {
    this._logger.debug(`Adicionando ao LRU: ${key}`);
    const node = new LRUNode(key, item);
    this._lruList.addToHead(node);
    this._lruNodes.set(key, node);
  }

  /**
   * @private
   * @description Remove um nó da lista LRU e do mapa de nós LRU, dado sua chave.
   * @param {string} key - A chave do item a ser removido da LRU.
   * @returns {void}
   */
  _removeFromLRU(key) {
    this._logger.debug(`Removendo do RLU: ${key}`);
    const node = this._lruNodes.get(key);
    if (node) {
      this._lruList.removeNode(node);
      this._lruNodes.delete(key);
    }
  }
  /**
   * @private
   * @description Move um nó existente para a cabeça da lista LRU, marcando-o como recentemente usado.
   * @param {string} key - A chave do item a ser movido.
   * @returns {void}
   */
  _moveToHeadLRU(key) {
    this._logger.debug(`Movendo para head LRU: ${key}`);
    const node = this._lruNodes.get(key);
    if (node) {
      this._lruList.moveToHead(node);
    }
  }

  /**
   * @private
   * @description Adiciona ou atualiza um item no heap de expiração com sua chave e tempo de expiração.
   * @param {string} key - A chave do item.
   * @param {number} expiresAt - O timestamp de expiração do item.
   * @returns {void}
   */
  _addToExpirationHeap(key, expiresAt) {
    this._logger.debug(`Adicionando ao heap de inspiração: ${key}`);
    // Ignora itens com TTL infinito
    if (expiresAt === Infinity) return;
    this._expirationHeap.push({ key, expiresAt }); // Adiciona um novo HeapItem ao heap.
  }

  /**
   * @private
   * @description Congela o objeto fornecido seguindo as opções fornecidas.
   * @param {*} obj - O objeto a ser congelado.
   * @param {number} [maxProps=1000] - Máximo de propriedades antes de abortar.
   * @param {Set<object>} [_seen] - Conjunto interno para evitar ciclos.
   * @returns {*} O objeto original ou congelado, conforme aplicável.
   */
  _deepFreeze(obj, maxProps = 1000, _seen = new Set()) {
    const shouldIgnore = (value) =>
      value instanceof Date ||
      value instanceof RegExp ||
      value instanceof Map ||
      value instanceof Set ||
      value instanceof WeakMap ||
      value instanceof WeakSet ||
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value) ||
      (typeof Buffer !== 'undefined' && value instanceof Buffer) ||
      typeof value === 'function';

    if (
      obj === null ||
      typeof obj !== 'object' ||
      Object.isFrozen(obj) ||
      _seen.has(obj) ||
      shouldIgnore(obj)
    ) {
      return obj;
    }

    if (this._options.freezeOption === freezeOptions.NONE) {
      return obj;
    }

    if (this._options.freezeOption === freezeOptions.SHALLOW) {
      return Object.freeze(obj);
    }

    _seen.add(obj);

    const keys = Object.getOwnPropertyNames(obj);
    if (keys.length > maxProps) return obj;

    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        this._deepFreeze(value, maxProps, _seen);
      }
    }

    Object.freeze(obj);
    this._logger?.debug?.('Deep frozen:', obj);

    return obj;
  }

  /**
   * @private
   * @description Realiza um clone profundo de um objeto usando `structuredClone`.
   * Este método é robusto e lida com referências circulares e a maioria dos tipos de dados JavaScript.
   * @param {*} obj - O objeto a ser clonado.
   * @returns {*} Uma cópia profunda do objeto.
   */
  _deepClone(obj) {
    this._logger.debug(`Clonando objeto: ${obj}`);
    return structuredClone(obj);
  }

  /**
   * @private
   * @description Retorna um clone otimizado de um valor. Para objetos, primeiro verifica
   * se um clone já existe no `WeakMap` (`#cloneCache`) para evitar clonagens desnecessárias.
   * Se não existir, um clone profundo é criado e cacheado.
   * @param {*} value - O valor a ser clonado ou retornado.
   * @returns {*} O clone otimizado do valor (para objetos) ou o próprio valor (para primitivos).
   */
  _optimizedClone(value) {
    this._logger.debug(`Clone de objeto otimizado: ${value}`);
    // Para tipos primitivos, retorna o próprio valor diretamente, pois não precisam de clonagem.
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Verifica se um clone já existe no cache de clones (WeakMap).
    let cached = this._cloneCache.get(value);
    if (cached) {
      return cached; // Se um clone cacheado for encontrado, retorna-o.
    }

    // Se nenhum clone cacheado for encontrado, cria um clone profundo.
    const cloned = this._deepClone(value);
    // Armazena o clone recém-criado no cache de clones para futuras solicitações.
    this._cloneCache.set(value, cloned);

    return cloned; // Retorna o clone.
  }
}

module.exports = { freezeOptions, MyCache };
