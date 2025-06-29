/**
 * @fileoverview Factory para criação e gerenciamento de instâncias CacheManager com sistema de relatórios integrado.
 * Implementa padrão Singleton para instância global e permite criação de instâncias isoladas.
 * @author Sistema de Cache
 * @version 1.0.0
 * @since 2024
 */

/**
 * @typedef {import('./src/types/log.types.js').LogLevelValue} LogLevelValue
 * @description Importa o tipo LogLevelValue do módulo de tipos de log
 */

// Importação das dependências principais do sistema
const CacheManager = require('./src/core/CacheManager.js');
const { getGlobalTaskQueue } = require('./src/taskQueue/index.js');
const Reporter = require('./src/logger/ReportLogger.js');
const { logLevel } = require('./src/utils/log.js');

/**
 * @typedef {Object} TimeIntervals
 * @description Constantes de tempo em milissegundos para intervalos de relatórios
 * @property {number} ONE_HOUR - Uma hora em milissegundos (3600000)
 * @property {number} THIRTY_MINUTES - Trinta minutos em milissegundos (1800000)  
 * @property {number} FIFTEEN_MINUTES - Quinze minutos em milissegundos (900000)
 */

// Constantes para intervalos de tempo - objeto imutável com intervalos predefinidos
const TIME_INTERVALS = Object.freeze({
  ONE_HOUR: 3600000,        // 60 * 60 * 1000 = 3600000ms
  THIRTY_MINUTES: 1800000,  // 30 * 60 * 1000 = 1800000ms  
  FIFTEEN_MINUTES: 900000   // 15 * 60 * 1000 = 900000ms
});

/**
 * @typedef {Object} ReportConfig
 * @description Configuração completa para relatórios do CacheManager
 * @property {boolean} [report=true] - Habilita ou desabilita a geração de relatórios
 * @property {number} [interval=3600000] - Intervalo em milissegundos entre relatórios
 * @property {boolean} [enableCache=true] - Inclui informações de cache nos relatórios
 * @property {boolean} [enableMemory=true] - Inclui informações de uso de memória
 * @property {boolean} [enableQueue=true] - Inclui informações da fila de tarefas
 * @property {boolean} [showHeader=true] - Exibe cabeçalho nos relatórios gerados
 * @property {string} [loggerModule='CACHE_MANAGER'] - Nome do módulo para identificação nos logs
 * @property {LogLevelValue} [logLevel] - Nível de log (INFO, DEBUG, ERROR, etc.)
 * @property {boolean} [useColors=true] - Habilita cores na saída dos logs
 * @property {boolean} [saveLogs=false] - Salva logs em arquivo no sistema
 */

// Configurações padrão centralizadas - objeto imutável com valores default
const DEFAULT_REPORT_CONFIG = Object.freeze({
  report: true,                           // Relatórios habilitados por padrão
  interval: TIME_INTERVALS.ONE_HOUR,      // Intervalo padrão de 1 hora
  enableCache: true,                      // Informações de cache habilitadas
  enableMemory: true,                     // Informações de memória habilitadas
  enableQueue: true,                      // Informações de fila habilitadas
  showHeader: true,                       // Cabeçalho nos relatórios habilitado
  loggerModule: 'CACHE_MANAGER',          // Nome padrão do módulo
  logLevel: logLevel.INFO,                // Nível de log INFO como padrão
  useColors: true,                        // Cores habilitadas nos logs
  saveLogs: false                         // Logs não salvos em arquivo por padrão
});

/**
 * @class CacheManagerFactory
 * @description Factory responsável por criar e gerenciar instâncias do CacheManager.
 * Implementa padrão Singleton para instância global e permite criação de instâncias isoladas.
 * Gerencia automaticamente recursos como reporters e filas de tarefas.
 * 
 * @example
 * // Obter instância global (singleton)
 * const globalCache = factory.getGlobalCacheManager();
 * 
 * @example  
 * // Criar instância isolada com relatórios
 * const isolatedCache = factory.createNewCacheManager({ 
 *   report: true, 
 *   interval: TIME_INTERVALS.FIFTEEN_MINUTES 
 * });
 */
class CacheManagerFactory {
  /**
   * @constructor
   * @description Inicializa a factory com estado limpo e coleções vazias
   */
  constructor() {
    /** @private @type {CacheManager|null} Instância singleton global do CacheManager */
    this._globalInstance = null;
    
    /** @private @type {Reporter|null} Reporter global associado à instância singleton */
    this._globalReporter = null;
    
    /** @private @type {*|null} Referência à fila global de tarefas (lazy loading) */
    this._globalQueue = null;
    
    /** @private @type {Set<Reporter>} Conjunto que rastreia reporters ativos para cleanup adequado */
    this._activeReporters = new Set(); // Rastreia reporters ativos para cleanup
  }

  /**
   * @method _getGlobalQueue
   * @description Obtém a fila global de tarefas usando lazy loading para otimização
   * @private
   * @returns {*} Instância da fila global de tarefas
   */
  _getGlobalQueue() {
    // Verifica se a fila global já foi inicializada
    if (!this._globalQueue) {
      // Inicializa a fila global apenas quando necessário (lazy loading)
      this._globalQueue = getGlobalTaskQueue();
    }
    // Retorna a referência da fila global
    return this._globalQueue;
  }

  /**
   * @method _createReporter
   * @description Cria e configura uma instância do Reporter de forma otimizada.
   * Evita recriação desnecessária de objetos de configuração para melhor performance.
   * @private
   * @param {ReportConfig} config - Configurações personalizadas do relatório
   * @param {string} [modulePrefix=''] - Prefixo para identificação do módulo nos logs
   * @returns {Reporter} Instância configurada do Reporter pronta para uso
   * 
   * @example
   * const reporter = this._createReporter({ interval: 300000 }, 'CUSTOM_');
   */
  _createReporter(config, modulePrefix = '') {
    // Otimização: evita recriação desnecessária do objeto de configuração
    // Se config é exatamente DEFAULT_REPORT_CONFIG, usa diretamente sem merge
    const mergedConfig = config === DEFAULT_REPORT_CONFIG 
      ? DEFAULT_REPORT_CONFIG 
      : { ...DEFAULT_REPORT_CONFIG, ...config };
    
    // Cria nova instância do Reporter com configurações mescladas
    const reporter = new Reporter({
      interval: mergedConfig.interval,                                    // Intervalo entre relatórios
      enableCache: mergedConfig.enableCache,                              // Habilita informações de cache
      enableMemory: mergedConfig.enableMemory,                            // Habilita informações de memória
      enableQueue: mergedConfig.enableQueue,                              // Habilita informações de fila
      showHeader: mergedConfig.showHeader,                                // Controla exibição do cabeçalho
      loggerModule: modulePrefix + mergedConfig.loggerModule,             // Nome do módulo com prefixo
      logLevel: mergedConfig.logLevel,                                    // Nível de log configurado
      useColors: mergedConfig.useColors,                                  // Controle de cores nos logs
      saveLogs: mergedConfig.saveLogs,                                    // Controle de salvamento em arquivo
    });

    // Registra o reporter no conjunto de reporters ativos para controle de lifecycle
    this._activeReporters.add(reporter);
    
    // Retorna a instância configurada
    return reporter;
  }

  /**
   * @method _setupReporter
   * @description Configura e inicia um reporter para uma instância específica de CacheManager.
   * Gerencia o ciclo de vida do reporter automaticamente.
   * @private
   * @param {CacheManager} cacheManager - Instância do cache manager a ser monitorada
   * @param {ReportConfig} reportConfig - Configurações específicas do relatório
   * @param {string} modulePrefix - Prefixo para identificação nos logs
   * @returns {Reporter|null} Reporter criado e iniciado, ou null se relatórios desabilitados
   */
  _setupReporter(cacheManager, reportConfig, modulePrefix) {
    // Verifica se relatórios estão habilitados na configuração
    if (!reportConfig.report) {
      // Retorna null se relatórios estão desabilitados
      return null;
    }

    // Cria nova instância do reporter com as configurações fornecidas
    const reporter = this._createReporter(reportConfig, modulePrefix);
    
    // Inicia o reporter associando-o ao cache manager e à fila global
    reporter.start(cacheManager, this._getGlobalQueue());
    
    // Retorna a instância do reporter configurado e ativo
    return reporter;
  }

  /**
   * @method getGlobalCacheManager
   * @description Retorna a instância global única do CacheManager implementando padrão Singleton.
   * Garante que apenas uma instância global existe durante toda a aplicação.
   * Configura reporter global apenas se solicitado e ainda não configurado.
   * 
   * @public
   * @param {ReportConfig} [reportConfig={}] - Configurações personalizadas para relatórios
   * @returns {CacheManager} Instância singleton do CacheManager
   * 
   * @example
   * // Obter instância global sem relatórios
   * const globalCache = factory.getGlobalCacheManager();
   * 
   * @example
   * // Obter instância global com relatórios personalizados
   * const globalCache = factory.getGlobalCacheManager({
   *   report: true,
   *   interval: TIME_INTERVALS.THIRTY_MINUTES,
   *   logLevel: logLevel.DEBUG
   * });
   * 
   * @example
   * // Criar cache específico usando a instância global
   * const userCache = globalCache.createCache('users', 300000);
   */
  getGlobalCacheManager(reportConfig = {}) {
    // Cria instância global apenas uma vez (implementação do padrão Singleton)
    if (!this._globalInstance) {
      // Inicializa a instância global do CacheManager
      this._globalInstance = new CacheManager();
    }

    // Configura reporter global apenas se solicitado e ainda não configurado
    if (reportConfig.report && !this._globalReporter) {
      // Configura e inicia o reporter global com prefixo identificador
      this._globalReporter = this._setupReporter(
        this._globalInstance,    // Instância global a ser monitorada
        reportConfig,           // Configurações do relatório
        'GLOBAL_'              // Prefixo para identificação nos logs
      );
    }
    
    // Retorna a instância global (sempre a mesma referência)
    return this._globalInstance;
  }

  /**
   * @method createNewCacheManager
   * @description Cria uma nova instância completamente isolada do CacheManager.
   * Útil para contextos que precisam de cache independente da instância global.
   * Cada instância criada é independente e pode ter suas próprias configurações.
   * 
   * @public
   * @param {ReportConfig} [reportConfig={}] - Configurações personalizadas para relatórios
   * @returns {CacheManager} Nova instância independente do CacheManager
   * 
   * @example
   * // Criar instância isolada básica
   * const sessionCache = factory.createNewCacheManager();
   * 
   * @example
   * // Criar instância isolada com monitoramento
   * const monitoredCache = factory.createNewCacheManager({ 
   *   report: true,
   *   interval: TIME_INTERVALS.FIFTEEN_MINUTES,
   *   loggerModule: 'SESSION_CACHE'
   * });
   * 
   * @example
   * // Usar instância isolada para contexto específico
   * const tempCache = factory.createNewCacheManager();
   * tempCache.createCache('temporary-data', 60000);
   */
  createNewCacheManager(reportConfig = {}) {
    // Cria nova instância independente do CacheManager
    const cacheManager = new CacheManager();
    
    // Configura reporter para a nova instância se solicitado
    this._setupReporter(
      cacheManager,      // Nova instância a ser monitorada
      reportConfig,      // Configurações personalizadas
      'ISOLATED_'       // Prefixo identificador para instâncias isoladas
    );
    
    // Retorna a nova instância independente
    return cacheManager;
  }

  /**
   * @method destroy
   * @description Destrói todos os recursos ativos da factory de forma segura.
   * Para todos os reporters ativos, limpa referências e reseta estado interno.
   * Essencial para evitar memory leaks, especialmente útil em testes e shutdown da aplicação.
   * 
   * @public
   * @returns {void}
   * 
   * @example
   * // Cleanup antes do shutdown da aplicação
   * process.on('SIGTERM', () => {
   *   factory.destroy();
   *   process.exit(0);
   * });
   * 
   * @example
   * // Cleanup em testes
   * afterEach(() => {
   *   factory.destroy();
   * });
   */
  destroy() {
    // Itera sobre todos os reporters ativos registrados
    this._activeReporters.forEach(reporter => {
      // Verifica se o reporter possui método stop antes de chamar
      if (typeof reporter.stop === 'function') {
        // Para o reporter de forma segura
        reporter.stop();
      }
    });

    // Reseta estado interno da factory para estado inicial limpo
    this._activeReporters.clear();        // Remove todas as referências de reporters
    this._globalInstance = null;          // Remove referência da instância global
    this._globalReporter = null;          // Remove referência do reporter global
    this._globalQueue = null;             // Remove referência da fila global
  }

   /**
   * @method getStats
   * @description Retorna estatísticas atuais da factory para monitoramento e debug.
   * Fornece informações sobre o estado interno dos recursos gerenciados.
   * 
   * @public
   * @returns {{hasGlobalInstance: boolean, hasGlobalReporter: boolean, activeReportersCount: number}} Objeto com estatísticas dos recursos ativos:
   * - hasGlobalInstance: Indica se existe instância global ativa
   * - hasGlobalReporter: Indica se existe reporter global ativo
   * - activeReportersCount: Número total de reporters ativos
   * 
   * @example
   * // Verificar estado da factory
   * const stats = factory.getStats();
   * console.log(`Reporters ativos: ${stats.activeReportersCount}`);
   * console.log(`Instância global: ${stats.hasGlobalInstance ? 'Sim' : 'Não'}`);
   */
  getStats() {
    // Retorna objeto com estatísticas atuais da factory
    return {
      hasGlobalInstance: !!this._globalInstance,           // Converte para boolean
      hasGlobalReporter: !!this._globalReporter,           // Converte para boolean
      activeReportersCount: this._activeReporters.size     // Número de reporters ativos
    };
  }
}

// Instância singleton da factory - ponto de entrada principal do módulo
const factory = new CacheManagerFactory();

/**
 * @typedef {Object} CacheManagerModule
 * @description Módulo exportado com interface pública para uso do CacheManager
 * @property {Function} getGlobalCacheManager - Função para obter instância global
 * @property {Function} createNewCacheManager - Função para criar nova instância
 * @property {TimeIntervals} TIME_INTERVALS - Constantes de tempo disponíveis
 * @property {Function} destroy - Função para cleanup de recursos
 * @property {Function} getFactoryStats - Função para obter estatísticas
 * @property {Function} _resetGlobalInstance - Função interna para reset (testes)
 * @property {CacheManagerFactory} _factory - Acesso direto à factory (casos avançados)
 */

// Interface pública do módulo - mantém compatibilidade com API anterior
module.exports = {
  /**
   * @function getGlobalCacheManager
   * @description Wrapper para obter a instância global do CacheManager
   * @param {ReportConfig} [config] - Configurações opcionais para relatórios
   * @returns {CacheManager} Instância singleton do CacheManager
   */
  getGlobalCacheManager: (config) => factory.getGlobalCacheManager(config),
  
  /**
   * @function createNewCacheManager  
   * @description Wrapper para criar nova instância isolada do CacheManager
   * @param {ReportConfig} [config] - Configurações opcionais para relatórios
   * @returns {CacheManager} Nova instância independente do CacheManager
   */
  createNewCacheManager: (config) => factory.createNewCacheManager(config),
  
  /**
   * @constant {TimeIntervals} TIME_INTERVALS
   * @description Constantes de tempo predefinidas para configuração de intervalos
   */
  TIME_INTERVALS,
  
  // Métodos adicionais para melhor controle do ciclo de vida
  
  /**
   * @function destroy
   * @description Função para cleanup completo de todos os recursos ativos
   * @returns {void}
   */
  destroy: () => factory.destroy(),
  
  /**
   * @function getFactoryStats
   * @description Função para obter estatísticas atuais da factory
   * @returns {Object} Estatísticas dos recursos gerenciados
   */
  getFactoryStats: () => factory.getStats(),
  
  // Métodos para testes e casos avançados - sempre disponíveis mas documentados como internos
  
  /**
   * @function _resetGlobalInstance
   * @description Alias para destroy() mantido para compatibilidade com código existente
   * @private
   * @deprecated Use destroy() no lugar desta função
   * @returns {void}
   */
  _resetGlobalInstance: () => factory.destroy(), // Alias para compatibilidade
  
  /**
   * @property {CacheManagerFactory} _factory
   * @description Acesso direto à instância da factory para casos de uso avançados
   * @private
   * @readonly
   */
  _factory: factory // Acesso direto à factory para casos avançados
};

// IMPORTANTE: Sempre chame destroy() antes do shutdown da aplicação
// para evitar memory leaks com timers ativos dos reporters

// PADRÃO DE USO RECOMENDADO:
// - Use getGlobalCacheManager() para cache compartilhado entre módulos
// - Use createNewCacheManager() para contextos isolados que precisam de cache independente