/**
 * @typedef {import('../types/cache.types.js').CacheInterface} CacheInterface
 * @typedef {import('../types/cache.types.js').PersistentCache} PersistentCache
 * @typedef {import('../types/cache.types.js').CacheConfigOptions} CacheConfigOptions
 * @typedef {import('../types/cache.types.js').MemoryStatsResult} MemoryStatsResult
 */

const { MyCache } = require('./Cache.js');
const { createPersistentCache } = require('../persistence/index.js');
const CacheConfiguration = require('./CacheConfiguration.js');
const Logger = require('../logger/Logger.js');
const { logStyles } = require('../utils/log.js');
const { getGlobalTaskQueue } = require('../taskQueue/index.js');
const globalQueue = getGlobalTaskQueue({
  logger: new Logger(logStyles.magenta('[OptimizedQueue1]')),
});

/**
 * @class CacheManager
 * @description Gerencia múltiplas instâncias de caches, incluindo `MyCache` e `PersistentCache`.
 * Oferece funcionalidades para criar, remover, obter, listar e inspecionar caches,
 * além de um mecanismo de limpeza automática para todos os caches gerenciados.
 */
class CacheManager {
  /**
   * @private
   * @type {Map<string, CacheInterface|PersistentCache>}
   * @description Um mapa que armazena as instâncias de cache, usando o nome do cache como chave.
   */
  _caches;

  /**
   * @private
   * @type {?NodeJS.Timeout|number}
   * @description O ID do intervalo para a limpeza automática de caches expirados. É `null` quando a limpeza automática está parada.
   * Em ambientes de navegador, pode ser um `number`. Em NodeJS, é um `NodeJS.Timeout`.
   */
  //_cleanupInterval;

  /**
   * @private
   * @type {number}
   * @description A frequência, em milissegundos, com que a limpeza automática é executada.
   * O valor padrão é 60000 ms (1 minuto).
   */
  _cleanupFrequency;

  /**
   * @private
   * @type {Logger}
   * @description Classe de log personalizadas para diferentes níveis de log.
   */
  _logger;

  _taskId;

  /**
   * Cria uma nova instância de CacheManager.
   * Inicializa o mapa de caches e configura o intervalo de limpeza como nulo e a frequência padrão.
   */
  constructor() {
    this._caches = new Map(); // Inicializa um novo Map para armazenar os caches.
    //this._cleanupInterval = null; // O intervalo de limpeza automática começa parado.
    this._cleanupFrequency = 60000; // Define a frequência padrão de limpeza para 1 minuto.
    this._taskId = 'cleanup';

    /**
     * Flag indicando se a instancia foi destruída, prevenindo operações em estado inválido
     */
    this.destroyed = false;
    this._logger = new Logger('CacheManager'); // Inicializa uma nova instancia de log.
    this._logger.info('Initialized...'); // Registra uma mensagem de log informando que o CacheManager foi inicializado.
  }

  /**
   * Cria uma nova instância de cache ou retorna uma existente se o nome já estiver em uso.
   * Suporta configuração através de um objeto de opções diretas ou de um perfil de configuração pré-definido.
   * Permite encapsular um cache básico com funcionalidade de persistência.
   *
   * @param {string} name - O nome único para identificar este cache.
   * @param {'memory-optimized'|'performance-optimized'|'balanced'|'persistent'|'persistent-performance'|'memory-optimized-with-persistence'|'minimal-critical-persistence'|CacheConfigOptions} [config='balanced'] - A configuração para o cache. Pode ser:
   * - Uma **string**: O nome de um perfil de configuração predefinido (assumindo a existência de `CacheConfiguration.fromProfile`).
   * - 'memory-optimized': Otimização para uso de memória.
   * - 'performance-optimized': Otimização para desempenho.
   * - 'balanced': Equilíbrio entre desempenho e uso de memória.
   * - 'persistent': Cache persistente, mas sem otimização de desempenho.
   * - 'persistent-performance': Cache persistente com otimização de desempenho.
   * - 'memory-optimized-with-persistence': Otimização de memória com persistência.
   * - Um **objeto (`CacheConfigOptions`)**: Um objeto contendo `defaultTTL`, `maxSize` e opcionalmente outras opções.
   * @param {Partial<CacheConfigOptions>} [overrides={}] - Um objeto de opções que sobrescreve qualquer configuração fornecida em `config`.
   * @returns {CacheInterface|PersistentCache} A instância do cache criada ou existente.
   * @throws {Error} Se a configuração for inválida ou se os parâmetros essenciais do cache forem inválidos.
   * @example
   * // Criando um cache com configuração padrão
   * const customCache = cacheManager.createCache('custom', {
   *     defaultTTL: 3600, // TTL padrão de 1 hora
   *     enableLRU: true, // Ativar LRU (Least Recently Used)
   *     enableAutoCleanup: true, // Ativar limpeza automática
   *     enableWeakOptimization: true, // Ativar otimização com WeakMap()
   *     maxSize: 100, // Tamanho máximo do cache
   *     cleanupFrequency: 10000, // Intervalo de limpeza automática (em milissegundos)
   *     freezeOption: freezeOptions.DEEP, // Opção de congelamento (deep | shallow | none)
   *     persistence: { // Configurações de persistência
   *         enabled: true, // Ativar persistência
   *         storageKey: 'cache_data', // Chave de armazenamento
   *         autoSaveInterval: 10000, // Intervalo de salvamento automático
   *     },
   * });
   */
  createCache(name, config = 'balanced', overrides = {}) {
    let finalOptions;

    if (typeof config === 'string') {
      finalOptions = CacheConfiguration.fromProfile(config, overrides);
    } else if (typeof config === 'object' && config !== null) {
      finalOptions = { ...config, ...overrides };
    } else {
      this._logger.error(
        'Configuração de cache deve ser um nome de perfil ou um objeto de opções.'
      );
    }

    // Validação básica dos parâmetros essenciais do cache
    const {
      defaultTTL = 3600,
      maxSize = 1000,
      persistence,
    } = finalOptions || {};
    if (!defaultTTL || !maxSize) {
      this._logger.error(
        'Parâmetros essenciais do cache inválidos. Verifique os valores de defaultTTL e maxSize.'
      );
    }
    this._logger.debug(
      `Configuração de cache: ${JSON.stringify(finalOptions)}`
    );
    this._validateCacheParams(name, defaultTTL, maxSize);

    // Verifica se o cache já existe e retorna a instância existente
    const existingCache = this._caches.get(name);
    if (existingCache) {
      this._logger.warn(
        `Cache "${name}" já existe. Retornando instância existente.`
      );
      return existingCache;
    }

    // Cria a instância base do MyCache
    /**@type {CacheInterface}*/
    const baseCache = new MyCache(name, defaultTTL, maxSize, finalOptions);
    let cacheInstance = baseCache;

    // Se houver configurações de persistência, encapsula o cache base
    if (persistence && persistence.enabled) {
      const storageKey = persistence.storageKey || `${name}_cache_data`;
      const autoSaveInterval =
        persistence.autoSaveInterval !== undefined
          ? persistence.autoSaveInterval
          : null;

      /**@type {PersistentCache}*/
      cacheInstance = createPersistentCache(
        baseCache,
        storageKey,
        autoSaveInterval
      );
      this._logger.info(
        `Cache "${name}" está sendo encapsulado com persistência.`
      );
    }

    this._caches.set(name, cacheInstance);

    if (finalOptions?.enableAutoCleanup && this._caches.size === 1) {
      this.startAutoCleanup(); // Inicia o cleanup global se for o primeiro cache
    }

    return cacheInstance;
  }

  /**
   * Remove um cache existente do gerenciador.
   * Se o cache for encontrado, ele é destruído (limpando seus recursos internos) e removido do gerenciador.
   * Se todos os caches forem removidos, a limpeza automática é interrompida.
   * @param {string} name - O nome do cache a ser removido.
   * @returns {void}
   */
  removeCache(name) {
    this._logger.info(`Removendo cache "${name}"`);
    const cache = this._caches.get(name);
    if (cache) {
      cache.destroy();
      this._caches.delete(name);
    }

    // Para limpeza automática se não há mais caches
    if (this._caches.size === 0) {
      this.stopAutoCleanup();
    }
  }

  /**
   * Obtém uma instância de cache pelo seu nome.
   * @param {string} name - O nome do cache a ser recuperado.
   * @returns {CacheInterface|PersistentCache|null} A instância do cache correspondente ao nome, ou `null` se não for encontrada.
   */
  getCache(name) {
    this._logger.debug(`Obtendo cache "${name}"`);
    return this._caches.get(name) || null;
  }

  /**
   * Lista os nomes de todos os caches atualmente gerenciados.
   * @returns {string[]} Um array contendo os nomes (chaves) de todos os caches.
   */
  listCaches() {
    this._logger.debug('Listando caches');
    return Array.from(this._caches.keys());
  }

  /**
   * Obtém estatísticas consolidadas de todos os caches gerenciados.
   * Cada cache deve implementar um método `getStats()` para fornecer suas próprias estatísticas.
   * @returns {Object} Um objeto contendo o número total de caches e um objeto aninhado com as estatísticas de cada cache, indexadas pelo seu nome.
   * @property {number} totalCaches - O número total de caches sendo gerenciados.
   * @property {Object.<string, MyCacheStats>} caches - Um objeto onde as chaves são os nomes dos caches e os valores são as estatísticas retornadas pelo método `getStats()` de cada cache.
   */
  getStats() {
    this._logger.debug('Obtendo estatísticas consolidadas');
    const stats = {
      totalCaches: this._caches.size,
      caches: {},
    };

    for (const [name, cache] of this._caches) {
      stats.caches[name] = cache.getStats();
    }

    return stats;
  }

  /**
   * Limpa itens expirados de todos os caches gerenciados.
   * Cada cache deve implementar um método `cleanup()`.
   * @returns {void}
   */
  cleanupAll() {
    let cont = 0;
    for (const cache of this._caches.values()) {
      if (cache.size() > 0) {
        cache.cleanup();
        cont++;
      }
    }

    if(cont > 0){
      this._logger.info(`${cont}/${this._caches.size} caches limpos.`);
    }

    const logStatus = this._logger.getBufferStatus()

    if (logStatus.percentageFull > 90) {
      this._logger.info(`${logStatus.cont}/${logStatus.maxSize} logs para descartes.`);

      const logs = this._logger.discardLogs();

      this._logger.info(`${logs.length} logs descartados.`);
      this._logger.debug(logs);
    }
  }

  /**
   * Configura a frequência para a limpeza automática periódica de todos os caches.
   * Se a limpeza automática já estiver ativa, ela é reiniciada com a nova frequência.
   * @param {number} frequency - A nova frequência em milissegundos. Deve ser um número maior ou igual a 1000.
   * @returns {void}
   * @throws {Error} Se a frequência fornecida não for um número ou for menor que 1000 ms.
   */
  setCleanupFrequency(frequency) {
    this._logger.debug(
      `Configurando frequência de limpeza para ${frequency}ms`
    );
    if (typeof frequency !== 'number' || frequency < 1000) {
      throw new Error('Frequência de limpeza deve ser um número >= 1000ms');
    }

    this._cleanupFrequency = frequency;

    // if (this._cleanupInterval) {
      this.stopAutoCleanup();
      this.startAutoCleanup();
    // }
  }

  /**
   * Inicia o processo de limpeza automática periódica em todos os caches gerenciados.
   * A limpeza ocorrerá na frequência definida por `this.#cleanupFrequency`.
   * Se a limpeza automática já estiver ativa, este método não faz nada.
   * @returns {void}
   */
  startAutoCleanup() {
    this._logger.debug('Iniciando limpeza automática');
    // if (this._cleanupInterval) return;

    // this._cleanupInterval = setInterval(() => {
    //   this.cleanupAll();
    // }, this._cleanupFrequency);
    globalQueue.addTask(
      this._taskId,
      () => {
        this.cleanupAll();
      },
      this._cleanupFrequency
    );
  }

  /**
   * Para o processo de limpeza automática periódica.
   * @returns {void}
   */
  stopAutoCleanup() {
    this._logger.debug('Parando limpeza automática');
    // if (this._cleanupInterval) {
    //   clearInterval(this._cleanupInterval);
    //   this._cleanupInterval = null;
    // }
    globalQueue.removeTask(this._taskId);
  }

  /**
   * Obtém estatísticas consolidadas de memória para todos os caches gerenciados.
   *
   * Este método percorre todos os caches disponíveis, coleta suas estatísticas individuais
   * e consolida os dados em um relatório abrangente de uso de memória.
   *
   * @method getConsolidateMemoryStats
   * @memberof CacheManager
   * @returns {MemoryStatsResult} Objeto contendo estatísticas consolidadas de memória
   *
   * @example
   * // Exemplo de uso do método
   * const cacheManager = new CacheManager();
   * const memStats = cacheManager.getConsolidateMemoryStats();
   *
   * console.log(`Total de caches: ${memStats.totalCaches}`);
   * console.log(`Tamanho estimado: ${memStats.consolidate.estimatedSize}`);
   * console.log(`Média por entrada: ${memStats.consolidate.averageEntrySize.toFixed(2)} bytes`);
   *
   * @since 1.0.0
   * @see {@link CacheMemoryStats} Para estrutura das estatísticas individuais
   */
  getConsolidateMemoryStats() {
    // Log de debug indicando início da operação de coleta de estatísticas
    this._logger.debug('Obtendo estatísticas de memória consolidadas');

    // Inicialização das variáveis acumuladoras para consolidação dos dados
    let totalSize = 0; // Acumulador para tamanho total em bytes
    let totalEntries = 0; // Acumulador para número total de entradas
    let objectEntries = 0; // Acumulador para entradas do tipo objeto
    let primitiveEntries = 0; // Acumulador para entradas de tipos primitivos
    let totalEstimatedSizeKB = 0; // Acumulador para tamanho estimado em KB

    // Iteração sobre todos os caches gerenciados na coleção Map
    for (const cache of this._caches.values()) {
      // Obtém as estatísticas de memória do cache atual
      const stats = cache.getMemoryStats();

      // Acumula o tamanho total de dados do cache atual
      totalSize += stats.totalSize;

      // Acumula o número total de entradas do cache atual
      totalEntries += stats.totalEntries;

      // Acumula o número de entradas de objetos do cache atual
      objectEntries += stats.objectEntries;

      // Acumula o número de entradas primitivas do cache atual
      primitiveEntries += stats.primitiveEntries;

      // Extração e conversão do valor numérico da string de tamanho estimado
      // Regex para capturar números (inteiros ou decimais) da string "123.45 KB"
      const match = /([\d.]+)/.exec(stats.estimatedSize);

      // Verifica se a regex encontrou um match válido
      if (match) {
        // Converte a string capturada para número float e acumula
        totalEstimatedSizeKB += parseFloat(match[1]);
      }
    }

    // Cálculo do tamanho médio por entrada, com proteção contra divisão por zero
    const averageEntrySize = totalEntries > 0 ? totalSize / totalEntries : 0;

    // Retorna o objeto com todas as estatísticas consolidadas
    return {
      // Número total de caches baseado no tamanho da Map
      totalCaches: this._caches.size,

      // Objeto consolidado com todas as métricas calculadas
      consolidate: {
        totalSize, // Tamanho total consolidado em bytes
        totalEntries, // Total de entradas consolidado
        objectEntries, // Total de entradas de objetos
        primitiveEntries, // Total de entradas primitivas
        averageEntrySize, // Tamanho médio calculado por entrada
        // Formatação do tamanho estimado total com duas casas decimais
        estimatedSize: `${totalEstimatedSizeKB.toFixed(2)} KB`,
      },
    };
  }

  /**
   * Destrói o `CacheManager` e todos os caches que ele gerencia.
   * Isso inclui parar a limpeza automática e chamar o método `destroy()` em cada cache.
   * @returns {void}
   */
  destroy() {
    this._logger.info('Destruindo o CacheManager');
    this.stopAutoCleanup();
    for (const cache of this._caches.values()) {
      cache.destroy();
    }
    this._caches.clear();
    this.destroyed = true;
  }

  /**
   * @private
   * @description Valida os parâmetros essenciais para a criação de um cache.
   * Este método emite avisos para `defaultTTL` e `maxSize` se forem inválidos,
   * permitindo que o cache chame seus próprios padrões internos se necessário.
   * @param {string} name - O nome do cache a ser validado.
   * @param {number} defaultTTL - O tempo de vida padrão em milissegundos para os itens do cache.
   * @param {number} maxSize - O tamanho máximo de itens que o cache pode armazenar.
   * @returns {void}
   * @throws {Error} Se o nome do cache for inválido.
   */
  _validateCacheParams(name, defaultTTL, maxSize) {
    this._logger.debug(
      `Validando parâmetros do cache "${name}"\ndefaultTTL: ${defaultTTL}, maxSize: ${maxSize}`
    );
    // Valida se o nome do cache é uma string não vazia.
    if (typeof name !== 'string' || name.trim() === '') {
      this._logger.error('Nome do cache deve ser uma string não vazia');
    }
    // Emite um aviso se o defaultTTL for inválido, em vez de lançar um erro.
    if (
      defaultTTL !== null &&
      (typeof defaultTTL !== 'number' ||
        defaultTTL < 0 ||
        !Number.isFinite(defaultTTL))
    ) {
      this._logger.warn(
        `[CacheManager] TTL padrão inválido ou ausente para cache "${name}". Usando default interno ou ajuste seu perfil.`
      );
    }
    // Emite um aviso se o maxSize for inválido, em vez de lançar um erro.
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      this._logger.warn(
        `[CacheManager] Tamanho máximo inválido ou ausente para cache "${name}". Usando default interno ou ajuste seu perfil.`
      );
    }
  }
}

module.exports = CacheManager;
