const { createNewCacheManager } = require('../index.js');
const Logger = require('../src/logger/Logger.js');
const { logLevel } = require('../src/utils/log.js');
const { withTimer } = require('../src/utils/Timers.js');
const { getGlobalTaskQueue } = require('../src/taskQueue/index.js');
const globalQueue = getGlobalTaskQueue({ logger: Logger });
const Reporter = require('../src/logger/ReportLogger.js');
const {
  stringifyReplacer,
  parseReviver,
} = require('../src/persistence/MinimalPersistence.js');

/**
 * SISTEMA DE TESTE DE CONFIABILIDADE DE DADOS
 *
 * Camada Lógica - Decomposição do Problema:
 * 1) Entendimento: Sistema para testar confiabilidade, integridade e desempenho de dados
 * 2) Desenvolvimento: Implementação com validação contínua e métricas detalhadas
 * 3) Validação: Verificação de consistência, detecção de corrupção e monitoramento
 *
 * Abordagens Implementadas:
 * - Funcional: Funções puras para validação e geração de dados de teste
 * - Orientada a Objetos: Classes para organização de testes e coleta de métricas
 */

// ==================== GERADOR DE DADOS DE TESTE ====================

/**
 * Gerador de dados complexos para testes de confiabilidade
 */
class TestDataGenerator {
  constructor() {
    this.counter = 0;
  }

  /**
   * Gera objetos complexos variados para teste de serialização/deserialização
   * @param {number | null} seed - Semente para geração de dados
   */
  generateComplexObject(seed = null) {
    const index = seed !== null ? seed : this.counter++;

    const generators = [
      // Objeto com dados primitivos variados
      () => ({
        type: 'primitive-mix',
        id: index,
        string: `test-string-${index}`,
        number: Math.random() * 1000,
        boolean: index % 2 === 0,
        nullValue: null,
        undefinedValue: undefined,
        timestamp: Date.now(),
        date: new Date().toISOString(),
      }),

      // Objeto com arrays complexos
      () => ({
        type: 'complex-arrays',
        id: index,
        numbers: Array.from({ length: 10 }, () => Math.random()),
        strings: Array.from({ length: 5 }, (_, i) => `item-${index}-${i}`),
        mixed: [1, 'string', true, { nested: index }, [1, 2, 3]],
        nested: {
          level1: {
            level2: {
              level3: { data: `deep-${index}` },
            },
          },
        },
      }),

      // Simulação de dados de API
      () => ({
        type: 'api-simulation',
        id: index,
        user: {
          id: Math.floor(Math.random() * 10000),
          name: `User ${index}`,
          email: `user${index}@test.com`,
          preferences: {
            theme: index % 2 === 0 ? 'dark' : 'light',
            notifications: Math.random() > 0.5,
            language: ['en', 'pt', 'es'][index % 3],
          },
        },
        metadata: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date(
            Date.now() + Math.random() * 86400000
          ).toISOString(),
          tags: [`tag-${index}`, 'test', 'complex'],
        },
      }),

      // Dados com estruturas grandes
      () => ({
        type: 'large-structure',
        id: index,
        largeArray: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: Math.random(),
          category: `category-${i % 10}`,
        })),
        matrix: Array.from({ length: 10 }, () =>
          Array.from({ length: 10 }, () => Math.random())
        ),
        textData: 'Lorem ipsum '.repeat(100) + `unique-${index}`,
      }),

      // Simulação de dados corrompidos/edge cases
      () => ({
        type: 'edge-cases',
        id: index,
        emptyString: '',
        emptyArray: [],
        emptyObject: {},
        specialChars: `!@#$%^&*()_+-={}[]|\\:";'<>?,./${index}`,
        unicode: `🚀 Test Unicode ${index} 🧪`,
        largeNumber: Number.MAX_SAFE_INTEGER - index,
        smallNumber: Number.MIN_SAFE_INTEGER + index,
        infinity: index % 10 === 0 ? Infinity : -Infinity,
      }),
    ];

    return generators[index % generators.length]();
  }

  /**
   * Gera chave única para teste
   */
  generateKey(prefix = 'test') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Gera dados corrompidos intencionalmente
   */
  generateCorruptedData() {
    const corruptions = [
      // JSON com sintaxe inválida (simulado como string)
      () => '{"invalid": json, "missing": quote}',

      // Dados com referências circulares simuladas
      () => {
        const obj = { type: 'circular', id: this.counter++ };
        obj.self = `[Circular Reference to ${obj.id}]`;
        return obj;
      },

      // Dados com tipos inconsistentes
      () => ({
        type: 'inconsistent-types',
        id: 'should-be-number',
        count: 'should-be-string',
        isActive: 'maybe',
        data: 12345,
      }),
    ];

    return corruptions[this.counter % corruptions.length]();
  }
}

// ==================== VALIDADOR DE INTEGRIDADE ====================

/**
 * Sistema de validação de integridade de dados
 */
class DataIntegrityValidator {
  constructor() {
    this.validationRules = new Map();
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // Regra: Verificar tipos esperados
    this.addRule('type-consistency', (data) => {
      if (!data || typeof data !== 'object') return false;

      if (data.type && typeof data.type !== 'string') {
        return { valid: false, error: 'Property type must be string' };
      }

      if (
        data.id !== undefined &&
        typeof data.id !== 'number' &&
        typeof data.id !== 'string'
      ) {
        return { valid: false, error: 'Property id must be number or string' };
      }

      return { valid: true };
    });

    // Regra: Verificar estrutura mínima
    this.addRule('minimal-structure', (data) => {
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Data must be an object' };
      }

      if (!data.hasOwnProperty('type') || !data.hasOwnProperty('id')) {
        return { valid: false, error: 'Data must have type and id properties' };
      }

      return { valid: true };
    });

    // Regra: Detectar corrupção de dados
    this.addRule('corruption-detection', (data) => {
      try {
        // Tenta serializar e deserializar
        const serialized = JSON.stringify(data, stringifyReplacer);
        const deserialized = JSON.parse(serialized, parseReviver);

        // Verifica se mantém propriedades essenciais
        if (data.type !== deserialized.type || data.id !== deserialized.id) {
          return {
            valid: false,
            error: 'Data corruption detected during serialization',
          };
        }

        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: `Serialization failed: ${error.message}`,
        };
      }
    });
  }

  addRule(name, validator) {
    this.validationRules.set(name, validator);
  }

  validate(data, rules = null) {
    const rulesToApply = rules || Array.from(this.validationRules.keys());
    /**
     * @type {{
     *  valid: boolean,
     *  errors: { rule: string, error: string }[],
     *  warnings: { rule: string, warning: string }[],
     *  testedRules: number
     * }}
     */
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      testedRules: rulesToApply.length,
    };

    for (const ruleName of rulesToApply) {
      const rule = this.validationRules.get(ruleName);
      if (!rule) continue;

      try {
        const result = rule(data);
        if (result.valid === false) {
          results.valid = false;
          results.errors.push({
            rule: ruleName,
            error: result.error || 'Validation failed',
          });
        } else if (result.warning) {
          results.warnings.push({
            rule: ruleName,
            warning: result.warning,
          });
        }
      } catch (error) {
        results.valid = false;
        results.errors.push({
          rule: ruleName,
          error: `Rule execution failed: ${error.message}`,
        });
      }
    }

    return results;
  }

  validateBulk(dataArray) {
    return dataArray.map((data, index) => ({
      index,
      ...this.validate(data),
    }));
  }
}

// ==================== MONITOR DE PERFORMANCE ====================

/**
 * Monitor de performance para operações de dados
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0,
      successRate: 0,
    };
    this.operationHistory = [];
    this.maxHistorySize = 1000;
  }

  startOperation() {
    return {
      startTime: Date.now(),
      end: (success = true, errorMessage = null) => {
        const endTime = Date.now();
        const duration =
          endTime -
          Date.now() +
          (Date.now() - (Date.now() - (endTime - Date.now())));
        const actualDuration = endTime - (Date.now() - duration);

        this.recordOperation(actualDuration, success, errorMessage);
        return actualDuration;
      },
    };
  }

  recordOperation(duration, success = true, errorMessage = null) {
    this.metrics.operations++;

    if (success) {
      this.metrics.totalTime += duration;
      this.metrics.minTime = Math.min(this.metrics.minTime, duration);
      this.metrics.maxTime = Math.max(this.metrics.maxTime, duration);
      this.metrics.averageTime =
        this.metrics.totalTime /
        (this.metrics.operations - this.metrics.errors);
    } else {
      this.metrics.errors++;
    }

    this.metrics.successRate =
      ((this.metrics.operations - this.metrics.errors) /
        this.metrics.operations) *
      100;

    // Histórico limitado
    this.operationHistory.push({
      timestamp: Date.now(),
      duration,
      success,
      errorMessage,
    });

    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getRecentOperations(count = 10) {
    return this.operationHistory.slice(-count);
  }

  reset() {
    this.metrics = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0,
      successRate: 0,
    };
    this.operationHistory = [];
  }
}

// ==================== TESTADOR DE CACHE MANAGER ====================

/**
 * Sistema especializado para teste do CacheManager
 */
class CacheManagerTester {
  constructor(cacheManager, options = {}) {
    this.cacheManager = cacheManager;
    this.logger = new Logger('[CacheManagerTest] ', logLevel.INFO);
    this.dataGenerator = new TestDataGenerator();
    this.validator = new DataIntegrityValidator();
    this.performanceMonitor = new PerformanceMonitor();

    this.config = {
      duration: options.duration || 120 * 60 * 1000, // 120 minutos como seu exemplo
      operationInterval: options.operationInterval || 25, // 25ms como seu exemplo
      verificationInterval: options.verificationInterval || 2 * 60 * 1000, // 2min como seu exemplo
      maxItemsPerCache: options.maxItemsPerCache || 50,
      corruptionRate: options.corruptionRate || 0.05,
      ...options,
    };
    this.logger.info(`🧪 Configurações usadas no teste:\n`, this.config);

    // Configurações dos caches como no seu exemplo
    this.cacheConfigs = [
      'memory-optimized',
      'performance-optimized',
      'balanced',
      'persistent',
      'persistent-performance',
      'memory-optimized-with-persistence',
      'minimal-critical-persistence',
    ];

    this.cachesNames = [
      'memoryOptimized',
      'performanceOptimized',
      'balanced',
      'persistent',
      'persistentPerformance',
      'memoryOptimizedWithPersistence',
      'minimalCriticalPersistence',
    ];

    this.cachesMetadata = {};
    this.createdCaches = new Map();
    this.statistics = {
      totalOperations: 0,
      cacheOperations: new Map(),
      validationsPassed: 0,
      validationsFailed: 0,
      corruptedDataDetected: 0,
      cacheErrors: 0,
      startTime: 0,
      endTime: 0,
    };
  }

  /**
   * Inicializa os caches com as configurações especificadas
   */
  async initializeCaches() {
    this.logger.info(
      `🧪 Criando ${this.cacheConfigs.length} caches com configurações variadas...`
    );
    const timer = this.logger.Timer('Inicialização de Caches');
    timer.start();

    try {
      // Cria caches conforme seu exemplo
      const memoryOptimized = this.cacheManager.createCache(
        'memoryOptimized',
        'memory-optimized'
      );
      timer.checkpoint('Cache memory-optimized criado');

      const performanceOptimized = this.cacheManager.createCache(
        'performanceOptimized',
        'performance-optimized'
      );
      timer.checkpoint('Cache performance-optimized criado');

      const balanced = this.cacheManager.createCache('balanced', 'balanced');
      timer.checkpoint('Cache balanced criado');

      const persistent = this.cacheManager.createCache(
        'persistent',
        'persistent',
        {
          persistence: { storageKey: 'persistent' },
        }
      );
      timer.checkpoint('Cache persistent criado');

      const persistentPerformance = this.cacheManager.createCache(
        'persistentPerformance',
        'persistent-performance',
        {
          persistence: { storageKey: 'persistentPerformance' },
        }
      );
      timer.checkpoint('Cache persistent-performance criado');

      const memoryOptimizedWithPersistence = this.cacheManager.createCache(
        'memoryOptimizedWithPersistence',
        'memory-optimized-with-persistence',
        {
          persistence: { storageKey: 'memoryOptimizedWithPersistence' },
        }
      );
      timer.checkpoint('Cache memory-optimized-with-persistence criado');

      const minimalCriticalPersistence = this.cacheManager.createCache(
        'minimalCriticalPersistence',
        'minimal-critical-persistence',
        {
          persistence: { storageKey: 'minimalCriticalPersistence' },
        }
      );
      timer.checkpoint('Cache minimal-critical-persistence criado');

      const noExpirationCache = this.cacheManager.createCache(
        'noExpirationCache',
        {
          defaultTTL: 3600, // TTL padrão de 1 hora
          enableLRU: true, // Ativar LRU (Least Recently Used)
          enableAutoCleanup: false, // Ativar limpeza automática
          enableWeakOptimization: true, // Ativar otimização com WeakMap()
          maxSize: 100, // Tamanho máximo do cache
          persistence: {
            // Configurações de persistência
            enabled: true, // Ativar persistência
            storageKey: 'noExpirationCache', // Chave de armazenamento
            autoSaveInterval: 10000, // Intervalo de salvamento automático
          },
        }
      );
      timer.checkpoint('Cache noExpirationCache criado');

      // Armazena referências e metadados
      this.createdCaches.set('memoryOptimized', memoryOptimized);
      this.createdCaches.set('performanceOptimized', performanceOptimized);
      this.createdCaches.set('balanced', balanced);
      this.createdCaches.set('persistent', persistent);
      this.createdCaches.set('persistentPerformance', persistentPerformance);
      this.createdCaches.set(
        'memoryOptimizedWithPersistence',
        memoryOptimizedWithPersistence
      );
      this.createdCaches.set(
        'minimalCriticalPersistence',
        minimalCriticalPersistence
      );
      this.createdCaches.set('noExpirationCache', noExpirationCache);

      // Inicializa metadados
      this.cachesNames.forEach((name, index) => {
        this.cachesMetadata[name] = {
          cacheName: name,
          id: index + 1,
          config: this.cacheConfigs[index],
          operationCount: 0,
          errorCount: 0,
          lastError: null,
        };
        this.statistics.cacheOperations.set(name, 0);
      });

      timer.end();
      this.logger.info('✅ Todos os caches foram criados com sucesso!');
    } catch (error) {
      this.logger.error('❌ Erro ao inicializar caches', error);
      throw error;
    }
  }

  /**
   * Executa teste completo do CacheManager
   */
  async runCacheManagerTest() {
    this.logger.info('🚀 Iniciando teste completo do CacheManager');
    const timer = this.logger.Timer('Teste Completo CacheManager');
    timer.start();

    this.statistics.startTime = Date.now();
    let lastVerification = this.statistics.startTime;
    let stopRequested = false;

    try {
      await this.initializeCaches();

      this.logger.info(
        `🧪 Executando teste de estresse (${
          this.config.duration / 60000
        } minutos)`
      );

      while (!stopRequested) {
        const now = Date.now();

        // Executa operações nos caches
        await this.performCacheOperations();

        // Verificação periódica
        if (now - lastVerification >= this.config.verificationInterval) {
          await this.performCacheVerification();
          this.logCacheProgress();
          lastVerification = now;
        }

        // Pausa entre operações
        await this.sleep(this.config.operationInterval);

        // Condição de parada
        if (now - this.statistics.startTime >= this.config.duration) {
          stopRequested = true;
        }
      }

      await this.performFinalCacheVerification();
      this.statistics.endTime = Date.now();

      timer.end();
      this.logFinalCacheResults();

      return this.generateCacheReport();
    } catch (error) {
      this.logger.error('❌ Erro durante teste do CacheManager', error);
      throw error;
    }
  }

  /**
   * Realiza operações nos caches (similar ao seu exemplo)
   */
  async performCacheOperations() {
    const operation = this.performanceMonitor.startOperation();

    try {
      // Seleciona cache aleatório
      const cacheIndex = Math.floor(Math.random() * this.cachesNames.length);
      const selectedCacheName = this.cachesNames[cacheIndex];
      const cache = this.createdCaches.get(selectedCacheName);
      this.createdCaches
        .get('noExpirationCache')
        .set('noExpirationValue', '1 2 3 nao expirei!!!', null);

      if (!cache) {
        throw new Error(`Cache ${selectedCacheName} não encontrado`);
      }

      if (!cache && selectedCacheName === 'noExpirationCache') return;

      // Gera chave e valor complexo
      const key = this.dataGenerator.generateKey(
        `complex-key-${this.statistics.totalOperations}`
      );
      const complexValue = this.dataGenerator.generateComplexObject(
        this.statistics.totalOperations
      );

      // Operação SET
      cache.set(key, complexValue);
      this.cachesMetadata[selectedCacheName].operationCount++;
      this.statistics.cacheOperations.set(
        selectedCacheName,
        this.statistics.cacheOperations.get(selectedCacheName) + 1
      );
      this.statistics.totalOperations++;

      // A cada 10 operações, faz leitura aleatória (como no seu exemplo)
      if (this.statistics.totalOperations % 10 === 0) {
        await this.performRandomRead();
      }

      // A cada 50 operações, força cleanup (como no seu exemplo)
      if (this.statistics.totalOperations % 50 === 0) {
        await this.performCacheCleanup();
      }

      operation.end(true);
    } catch (error) {
      this.logger.warn(`⚠️ Erro na operação de cache: ${error.message}`);
      this.statistics.cacheErrors++;
      operation.end(false, error.message);
    }
  }

  /**
   * Realiza leitura aleatória nos caches
   */
  async performRandomRead() {
    try {
      const randomCacheName =
        this.cachesNames[Math.floor(Math.random() * this.cachesNames.length)];
      const cache = this.createdCaches.get(randomCacheName);

      if (!cache && randomCacheName === 'noExpirationCache') return;

      const allKeys = cache.keys();
      if (allKeys.length > 0) {
        const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        const value = cache.get(randomKey);

        // Validação do objeto recuperado
        if (value && typeof value === 'object' && value.type) {
          const validationResult = this.validator.validate(value);

          if (validationResult.valid) {
            this.statistics.validationsPassed++;
          } else {
            this.statistics.validationsFailed++;
            this.logger.info(
              `🔍 Validação falhou para chave ${randomKey}: ${validationResult.errors[0]?.error}`
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`⚠️ Erro na leitura aleatória: ${error.message}`);
    }
  }

  /**
   * Executa cleanup nos caches
   */
  async performCacheCleanup() {
    try {
      const cleanupCount = Math.min(3, this.cachesNames.length);

      for (let i = 0; i < cleanupCount; i++) {
        const cleanupIndex = Math.floor(
          Math.random() * this.cachesNames.length
        );
        const cacheName = this.cachesNames[cleanupIndex];
        const cache = this.createdCaches.get(cacheName);

        if (cache && typeof cache.cleanup === 'function') {
          cache.cleanup();
          this.logger.debug(`🧹 Cleanup executado no cache ${cacheName}`);
        }
      }
    } catch (error) {
      this.logger.error(`⚠️ Erro no cleanup: ${error.message}`);
    }
  }

  /**
   * Verificação dos caches
   */
  async performCacheVerification() {
    this.logger.info('🔍 Executando verificação dos caches');

    let totalItems = 0;
    const cacheStats = [];

    for (const [cacheName, cache] of this.createdCaches) {
      if (cacheName === 'noExpirationCache') return;
      try {
        const keys = cache.keys();
        const metadata = this.cachesMetadata[cacheName];

        totalItems += keys.length;
        cacheStats.push({
          name: cacheName,
          config: metadata.config,
          items: keys.length,
          operations: metadata.operationCount,
          errors: metadata.errorCount,
        });

        // Validação de amostra
        if (keys.length > 0) {
          const sampleKey = keys[Math.floor(Math.random() * keys.length)];
          const sampleValue = cache.get(sampleKey);

          if (sampleValue) {
            const validationResult = this.validator.validate(sampleValue);
            if (!validationResult.valid) {
              this.statistics.corruptedDataDetected++;
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `⚠️ Erro ao verificar cache ${cacheName}: ${error.message}`
        );
        this.cachesMetadata[cacheName].errorCount++;
        this.cachesMetadata[cacheName].lastError = error.message;
      }
    }

    this.logger.info(
      `✅ Verificação concluída: ${totalItems} itens em ${this.createdCaches.size} caches`
    );
    return { totalItems, cacheStats };
  }

  /**
   * Verificação final completa
   */
  async performFinalCacheVerification() {
    this.logger.info('🏁 Executando verificação final dos caches');
    const finalStats = await this.performCacheVerification();

    // Coleta amostras finais para relatório
    this.finalSamples = [];
    let sampleCount = 0;
    const maxSamples = 5;

    for (const [cacheName, cache] of this.createdCaches) {
      if (cacheName === 'noExpirationCache') return;
      if (sampleCount >= maxSamples) break;

      try {
        const keys = cache.keys();
        if (keys.length > 0) {
          const sampleKey = keys[0];
          const sampleValue = cache.get(sampleKey);

          this.finalSamples.push({
            cacheName,
            config: this.cachesMetadata[cacheName].config,
            key: sampleKey,
            valueType: sampleValue?.type || 'unknown',
            hasComplexData: !!(
              sampleValue?.data ||
              sampleValue?.items ||
              sampleValue?.metadata
            ),
          });
          sampleCount++;
        }
      } catch (error) {
        this.logger.error(
          `⚠️ Erro ao coletar amostra do cache ${cacheName}: ${error.message}`
        );
      }
    }

    return finalStats;
  }

  /**
   * Log de progresso específico para caches
   */
  logCacheProgress() {
    const elapsed = Date.now() - this.statistics.startTime;
    const elapsedMinutes = Math.round(elapsed / 60000);
    const performanceMetrics = this.performanceMonitor.getMetrics();

    let totalItems = 0;
    for (const [cacheName, cache] of this.createdCaches) {
      try {
        totalItems += cache.keys().length;
      } catch (error) {
        // Ignora erros na contagem
      }
    }

    this.logger.info(
      '🔍 Verificando se o valor "noExpirationValue" ainda está presente...\n',
      this.createdCaches.get('noExpirationCache').get('noExpirationValue')
    );

    this.logger.info(
      `📊 Progresso ${elapsedMinutes}min ➜ ${totalItems} itens em ${this.createdCaches.size} caches`
    );
    this.logger.info(
      `🔄 Operações: ${this.statistics.totalOperations} | Erros: ${
        this.statistics.cacheErrors
      } | Taxa sucesso: ${performanceMetrics.successRate.toFixed(1)}%`
    );

    // Top 3 caches mais ativos
    const topCaches = Array.from(this.statistics.cacheOperations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, ops]) => `${name}:${ops}`)
      .join(', ');

    this.logger.info(`🏆 Top 3 caches: ${topCaches}`);

    // this.logger.info(
    //   'Status detalhado da fila de tarefas:',
    //   globalQueue.getStatus()
    // );
  }

  /**
   * Log de resultados finais específico para CacheManager
   */
  logFinalCacheResults() {
    const duration = this.statistics.endTime - this.statistics.startTime;
    const performanceMetrics = this.performanceMonitor.getMetrics();

    this.logger.info('🎯 === RESULTADOS FINAIS TESTE CACHEMANAGER ===');
    this.logger.info(
      `⏱️ Duração total: ${Math.round(duration / 60000)} minutos`
    );
    this.logger.info(`📝 Operações totais: ${this.statistics.totalOperations}`);
    this.logger.info(`🗄️ Caches criados: ${this.createdCaches.size}`);
    this.logger.info(
      `✅ Validações aprovadas: ${this.statistics.validationsPassed}`
    );
    this.logger.info(
      `❌ Validações falharam: ${this.statistics.validationsFailed}`
    );
    this.logger.info(
      `🔍 Dados corrompidos detectados: ${this.statistics.corruptedDataDetected}`
    );
    this.logger.info(`⚠️ Erros de cache: ${this.statistics.cacheErrors}`);
    this.logger.info(
      `⚡ Performance média: ${
        performanceMetrics.averageTime?.toFixed(2) || 0
      }ms por operação`
    );

    // Estatísticas por cache
    this.logger.info('📊 Operações por cache:');
    for (const [cacheName, operations] of this.statistics.cacheOperations) {
      const metadata = this.cachesMetadata[cacheName];
      this.logger.info(
        `   ${cacheName} (${metadata.config}): ${operations} ops, ${metadata.errorCount} erros`
      );
    }

    if (this.finalSamples && this.finalSamples.length > 0) {
      this.logger.info(`🔎 Amostras finais: `, this.finalSamples);
    }

    // this.logger.info(
    //   'Consumo final de memoria dos caches',
    //   this.cacheManager.getConsolidateMemoryStats()
    // );
    // this.logger.info(
    //   'Consumo final de memoria por cache',
    //   this.cacheManager.listCaches().map((cacheName) => ({
    //     cacheName,
    //     memory: this.cacheManager.getCache(cacheName).getMemoryStats(),
    //   }))
    // );

    // this.logger.info(
    //   'Status detalhado da fila de tarefas:',
    //   globalQueue.getStatus()
    // );

    this.logger.info(
      '🔍 "noExpirationValue" sobreviveu ao final do teste.\n',
      this.createdCaches.get('noExpirationCache').get('noExpirationValue')
    );
  }

  /**
   * Gera relatório específico para CacheManager
   */
  generateCacheReport() {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    const duration = this.statistics.endTime - this.statistics.startTime;

    let totalFinalItems = 0;
    const cacheDetails = [];

    for (const [cacheName, cache] of this.createdCaches) {
      try {
        const keys = cache.keys();
        const metadata = this.cachesMetadata[cacheName];

        totalFinalItems += keys.length;
        cacheDetails.push({
          name: cacheName,
          config: metadata.config,
          finalItems: keys.length,
          totalOperations: metadata.operationCount,
          errorCount: metadata.errorCount,
          lastError: metadata.lastError,
        });
      } catch (error) {
        cacheDetails.push({
          name: cacheName,
          config: this.cachesMetadata[cacheName]?.config,
          error: error.message,
        });
      }
    }

    return {
      testType: 'CacheManager Reliability Test',
      summary: {
        duration: duration,
        totalOperations: this.statistics.totalOperations,
        cachesCreated: this.createdCaches.size,
        totalFinalItems: totalFinalItems,
        cacheErrors: this.statistics.cacheErrors,
        successRate: performanceMetrics.successRate || 0,
      },
      validation: {
        passed: this.statistics.validationsPassed,
        failed: this.statistics.validationsFailed,
        corruptedDetected: this.statistics.corruptedDataDetected,
      },
      performance: performanceMetrics,
      cacheDetails: cacheDetails,
      samples: this.finalSamples || [],
      operationsByCache: Object.fromEntries(this.statistics.cacheOperations),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Utilitário para sleep assíncrono
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup de recursos
   */
  async destroy() {
    try {
      // if (
      //   this.cacheManager &&
      //   typeof this.cacheManager.destroy === 'function'
      // ) {
      //   this.cacheManager.destroy();
      // }
      this.createdCaches.clear();
      this.performanceMonitor.reset();
      this.logger.info('🧹 Recursos do CacheManager liberados');
    } catch (error) {
      this.logger.warn('⚠️ Erro ao limpar recursos:', error.message);
    } finally {
      await this.logger.save('CacheManagerTester');
    }
  }
}

// ==================== SISTEMA PRINCIPAL DE TESTES ====================

/**
 * Sistema principal de teste de confiabilidade de dados
 * @param {import('../src/types/cache.types.js').CacheInterface} auditedCache - Cache a ser testado
 */
class DataReliabilityTester {
  constructor(auditedCache, options = {}) {
    this.logger = new Logger('[DataReliabilityTest] ', logLevel.DEBUG);
    this.dataGenerator = new TestDataGenerator();
    this.validator = new DataIntegrityValidator();
    this.performanceMonitor = new PerformanceMonitor();

    this.config = {
      duration: options.duration || 5 * 60 * 1000, // 5 minutos padrão
      operationInterval: options.operationInterval || 50, // 50ms entre operações
      verificationInterval: options.verificationInterval || 30 * 1000, // Verificação a cada 30s
      maxDataItems: options.maxDataItems || 1000,
      corruptionRate: options.corruptionRate || 0.05, // 5% de dados corrompidos
      ...options,
    };

    this.testData = auditedCache;
    this.statistics = {
      totalOperations: 0,
      dataItemsCreated: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      corruptedDataDetected: 0,
      startTime: 0,
      endTime: 0,
    };
  }

  /**
   * Executa teste completo de confiabilidade
   */
  async runReliabilityTest() {
    this.logger.info('🧪 Iniciando teste de confiabilidade de dados');
    const timer = this.logger.Timer('Teste de Confiabilidade');
    timer.start();

    this.statistics.startTime = Date.now();
    let lastVerification = this.statistics.startTime;

    try {
      while (Date.now() - this.statistics.startTime < this.config.duration) {
        await this.performTestCycle();

        // Verificação periódica
        const now = Date.now();
        if (now - lastVerification >= this.config.verificationInterval) {
          await this.performIntegrityVerification();
          this.logProgress();
          lastVerification = now;
        }

        // Pausa entre operações
        await this.sleep(this.config.operationInterval);
      }

      await this.performFinalVerification();
      this.statistics.endTime = Date.now();

      timer.end();
      this.logFinalResults();

      return this.generateReport();
    } catch (error) {
      this.logger.error('❌ Erro durante teste de confiabilidade', error);
      throw error;
    }
  }

  /**
   * Executa um ciclo de teste
   */
  async performTestCycle() {
    const operation = this.performanceMonitor.startOperation();

    try {
      // Gera dados de teste
      const shouldCorrupt = Math.random() < this.config.corruptionRate;
      const testData = shouldCorrupt
        ? this.dataGenerator.generateCorruptedData()
        : this.dataGenerator.generateComplexObject();

      const key = this.dataGenerator.generateKey('reliability');

      // Armazena dados
      this.testData.set(key, {
        data: testData,
        created: Date.now(),
        corrupted: shouldCorrupt,
        validated: false,
      });

      this.statistics.dataItemsCreated++;

      // Limita tamanho dos dados de teste
      if (this.testData.size() > this.config.maxDataItems) {
        const firstKey = this.testData.keys()[0];
        this.testData.delete(firstKey);
      }

      // Valida dados aleatoriamente
      if (Math.random() < 0.3) {
        // 30% chance de validação imediata
        await this.validateRandomData();
      }

      this.statistics.totalOperations++;
      operation.end(true);
    } catch (error) {
      this.logger.warn('⚠️ Erro no ciclo de teste', error.message);
      operation.end(false, error.message);
    }
  }

  /**
   * Valida dados aleatórios
   */
  async validateRandomData() {
    const keys = this.testData.keys();
    if (keys.length === 0) return;

    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const dataItem = this.testData.get(randomKey);

    if (!dataItem || dataItem.validated) return;

    const validationResult = this.validator.validate(dataItem.data);
    dataItem.validated = true;
    dataItem.validationResult = validationResult;

    if (validationResult.valid) {
      this.statistics.validationsPassed++;
    } else {
      this.statistics.validationsFailed++;
      if (dataItem.corrupted) {
        this.statistics.corruptedDataDetected++;
      }
      this.logger.warn(
        `❌ Dados corrompidos detectados: ${JSON.stringify(dataItem.data)}`,
      );
    }
  }

  /**
   * Verificação completa de integridade
   */
  async performIntegrityVerification() {
    this.logger.info('🔍 Executando verificação de integridade');

    let validatedCount = 0;
    for (const key of this.testData.keys()) {
      const dataItem = this.testData.get(key);
      if (!dataItem.validated) {
        const validationResult = this.validator.validate(dataItem.data);
        dataItem.validated = true;
        dataItem.validationResult = validationResult;

        if (validationResult.valid) {
          this.statistics.validationsPassed++;
        } else {
          this.statistics.validationsFailed++;
          if (dataItem.corrupted) {
            this.statistics.corruptedDataDetected++;
          }
        }
        validatedCount++;
      }
    }

    this.logger.info(
      `✅ Verificação concluída: ${validatedCount} itens validados`
    );
  }

  /**
   * Verificação final completa
   */
  async performFinalVerification() {
    this.logger.info('🏁 Executando verificação final');
    await this.performIntegrityVerification();

    // Calcula estatísticas finais
    const totalValidations =
      this.statistics.validationsPassed + this.statistics.validationsFailed;
    const successRate =
      totalValidations > 0
        ? (this.statistics.validationsPassed / totalValidations) * 100
        : 0;
    const corruptionDetectionRate =
      this.statistics.corruptedDataDetected > 0
        ? (this.statistics.corruptedDataDetected /
            this.statistics.validationsFailed) *
          100
        : 0;

    this.statistics.finalSuccessRate = successRate;
    this.statistics.corruptionDetectionRate = corruptionDetectionRate;
  }

  /**
   * Log de progresso
   */
  logProgress() {
    const elapsed = Date.now() - this.statistics.startTime;
    const elapsedMinutes = Math.round(elapsed / 60000);
    const performanceMetrics = this.performanceMonitor.getMetrics();

    this.logger.info(
      `📊 Progresso ${elapsedMinutes}min - Operações: ${
        this.statistics.totalOperations
      }, Dados: ${this.testData.size()}, Taxa sucesso: ${performanceMetrics.successRate.toFixed(
        1
      )}%`
    );
  }

  /**
   * Log de resultados finais
   */
  logFinalResults() {
    const duration = this.statistics.endTime - this.statistics.startTime;
    const performanceMetrics = this.performanceMonitor.getMetrics();

    this.logger.info('🎯 === RESULTADOS FINAIS DO TESTE DE CONFIABILIDADE ===');
    this.logger.info(`⏱️ Duração total: ${Math.round(duration / 1000)}s`);
    this.logger.info(`📝 Operações totais: ${this.statistics.totalOperations}`);
    this.logger.info(
      `💾 Itens de dados criados: ${this.statistics.dataItemsCreated}`
    );
    this.logger.info(
      `✅ Validações aprovadas: ${this.statistics.validationsPassed}`
    );
    this.logger.info(
      `❌ Validações falharam: ${this.statistics.validationsFailed}`
    );
    this.logger.info(
      `🔍 Corrupções detectadas: ${this.statistics.corruptedDataDetected}`
    );
    this.logger.info(
      `📈 Taxa de sucesso final: ${
        this.statistics.finalSuccessRate?.toFixed(1) || 0
      }%`
    );
    this.logger.info(
      `🎯 Performance média: ${
        performanceMetrics.averageTime?.toFixed(2) || 0
      }ms por operação`
    );
  }

  /**
   * Gera relatório final
   */
  generateReport() {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    const duration = this.statistics?.endTime - this.statistics?.startTime;

    return {
      summary: {
        duration: duration || 0,
        totalOperations: this.statistics.totalOperations,
        dataItemsCreated: this.statistics.dataItemsCreated,
        finalDataSize: this.testData.size(),
        successRate: this.statistics.finalSuccessRate || 0,
        corruptionDetectionRate: this.statistics.corruptionDetectionRate || 0,
      },
      validation: {
        passed: this.statistics.validationsPassed,
        failed: this.statistics.validationsFailed,
        corruptedDetected: this.statistics.corruptedDataDetected,
      },
      performance: performanceMetrics,
      samples: this.getSampleData(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Coleta amostras de dados para análise
   */
  getSampleData() {
    const samples = [];
    let count = 0;
    const maxSamples = 5;

    for (const key of this.testData.keys()) {
      const dataItem = this.testData.get(key);
      if (count >= maxSamples) break;

      samples.push({
        key,
        type: dataItem.data?.type || 'unknown',
        corrupted: dataItem.corrupted,
        validated: dataItem.validated,
        validationResult: dataItem.validationResult?.valid || false,
        created: dataItem.created,
      });
      count++;
    }

    return samples;
  }

  /**
   * Utilitário para sleep assíncrono
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup de recursos
   */
  async destroy() {
    this.testData.destroy();
    this.performanceMonitor.reset();
    this.logger.info('🧹 Recursos de teste liberados');
    await this.logger.save('DataReliabilityTester');
  }
}

// ==================== EXECUÇÃO DO TESTE ====================

/**
 * Função principal para executar teste de confiabilidade
 */
async function executeReliabilityTest(auditedCache, options = {}) {
  const tester = new DataReliabilityTester(auditedCache, {
    duration: 10 * 60 * 1000, // 2 minutos para demonstração
    operationInterval: 25,
    verificationInterval: 15 * 1000, // Verifica a cada 15 segundos
    maxDataItems: 500,
    corruptionRate: 0.1, // 10% de corrupção para teste
    ...options,
  });

  try {
    const report = await tester.runReliabilityTest();

    console.log('\n📋 === RELATÓRIO FINAL ===');
    console.log('📊 Resumo:', JSON.stringify(report.summary, null, 2));
    console.log('✅ Validação:', JSON.stringify(report.validation, null, 2));
    console.log('⚡ Performance:', JSON.stringify(report.performance, null, 2));

    return report;
  } catch (error) {
    console.error('💥 Falha no teste de confiabilidade:', error);
    throw error;
  } finally {
    tester.destroy();
  }
}

/**
 * Função principal para executar teste específico do CacheManager
 */
async function executeCacheManagerTest(cacheManager, options = {}) {
  if (!cacheManager) {
    throw new Error('CacheManager é obrigatório para executar o teste');
  }

  const tester = new CacheManagerTester(cacheManager, {
    duration: 10 * 60 * 1000, // 120 minutos como seu exemplo original
    operationInterval: 25, // 25ms como seu exemplo
    verificationInterval: 1 * 60 * 1000, // 2 minutos como seu exemplo
    maxItemsPerCache: 500, // Como no seu exemplo
    corruptionRate: 0.2, // 5% de dados corrompidos
    ...options,
  });

  try {
    const report = await tester.runCacheManagerTest();

    console.log('\n🗄️ === RELATÓRIO FINAL CACHEMANAGER ===');
    console.log('📊 Resumo:', JSON.stringify(report.summary, null, 2));
    console.log('✅ Validação:', JSON.stringify(report.validation, null, 2));
    console.log('⚡ Performance:', JSON.stringify(report.performance, null, 2));
    console.log(
      '🗄️ Detalhes dos Caches:',
      JSON.stringify(report.cacheDetails, null, 2)
    );
    console.log(
      '📈 Operações por Cache:',
      JSON.stringify(report.operationsByCache, null, 2)
    );

    return report;
  } catch (error) {
    console.error('💥 Falha no teste do CacheManager:', error);
    throw error;
  } finally {
    await tester.destroy();
  }
}

const testeExecuter = async () => {
  const cacheManager = createNewCacheManager({
    report: true,
    interval: 1 * 60 * 1000,
    saveLogs: true,
  });
  const logger = new Logger('testeExecuter', logLevel.DEBUG);

  try {
    logger.info('🧪 Iniciando teste padrão do CacheManager...');
    const CacheManagerTestWithTimer = withTimer(
      executeCacheManagerTest,
      'executeCacheManagerTest'
    );
    await CacheManagerTestWithTimer(cacheManager);
    logger.info('✅ Teste padrão concluído com sucesso.');

    try {
      logger.info('🗄️ Criando cache com persistência...');
      const persistent = cacheManager.createCache('memoryOptimized', 'memory-optimized');

      logger.info(
        '🧪 Iniciando teste de confiabilidade no cache persistente...'
      );
      const ReliabilityTestWithTimer = withTimer(
        executeReliabilityTest,
        'executeReliabilityTest'
      );
      await ReliabilityTestWithTimer(persistent);
      logger.info('✅ Teste de confiabilidade concluído com sucesso.');
    } catch (error) {
      logger.error('💥 Teste de confiabilidade falhou:', error);
    }
  } catch (error) {
    logger.error('💥 Teste básico falhou:', error);
  } finally {
    logger.info('🧹 Finalizando testes e destruindo recursos...');
    cacheManager.destroy?.();
    globalQueue.destroy();
    // report.destroy()
  }
};

testeExecuter();
