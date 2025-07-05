/**
 * @typedef {import('../types/log.types.js').LogLevelValue} LogLevelValue
 */

const CacheManager = require('../core/CacheManager.js');
const Logger = require('./Logger');
const { createNewTaskQueue } = require('../taskQueue/index.js');
const { logLevel, logStyles } = require('../utils/log.js');
const { formatDuration } = require('./../utils/utils.js');
/**
 * ReportLogger - Sistema de logging humanizado para estatísticas de sistema
 *
 * Monitora e exibe de forma humanizada:
 * - Estatísticas globais de cache
 * - Uso de memória consolidado
 * - Status de filas de tarefas
 *
 * @class ReportLogger
 * @example
 * const reporter = new ReportLogger({
 *   interval: 30000, // 30 segundos
 *   enableCache: true,
 *   enableMemory: true,
 *   enableQueue: true
 * });
 *
 * reporter.start(cacheManager, queue);
 */
class ReportLogger {
  /**
   * Construtor da classe ReportLogger
   * @param {Object} options - Configurações do reporter
   * @param {number} [options.interval=60000] - Intervalo em milissegundos (padrão: 1 minuto)
   * @param {boolean} [options.enableCache=true] - Habilitar relatório de cache
   * @param {boolean} [options.enableMemory=true] - Habilitar relatório de memória
   * @param {boolean} [options.enableQueue=true] - Habilitar relatório de fila
   * @param {string} [options.loggerModule='REPORTER'] - Nome do módulo para o logger
   * @param {LogLevelValue} [options.logLevel=logLevel.INFO] - Nível de log
   * @param {boolean} [options.showHeader=true] - Exibir cabeçalho do relatório
   * @param {boolean} [options.useColors=true] - Usar cores na saída
   * @param {boolean} [options.saveLogs=false] - Salvar logs em arquivo
   */
  constructor(options = {}) {
    // Configurações padrão
    this.config = {
      interval: options.interval || 60000, // 1 minuto
      enableCache: options.enableCache !== false,
      enableMemory: options.enableMemory !== false,
      enableQueue: options.enableQueue !== false,
      loggerModule: options.loggerModule || 'REPORTER',
      logLevel: options.logLevel || logLevel.INFO,
      showHeader: options.showHeader !== false,
      useColors: options.useColors !== false,
      saveLogs: options.saveLogs !== false,
    };

    // Estado interno
    this.isRunning = false;
    this.logger = null;
    this.cacheManager = null;
    this.queue = null;
    this.reportCount = 0;
    this.startTime = 0;
    this.logger = new Logger(
      logStyles.subtle(this.config.loggerModule),
      this.config.logLevel
    );
    this.taskQueue = createNewTaskQueue({
      minTickInterval: 1000,
      logger: this.logger,
    });
    this.lastStatus = {
      cache: {},
      memory: {},
      queue: {},
    };
  }

  /**
   * Inicia o monitoramento automático
   * @param {CacheManager} cacheManager - Instância do gerenciador de cache
   * @param {Object} queue - Instância da fila de tarefas
   */
  start(cacheManager, queue) {
    if (this.isRunning) {
      this.logger.warn('ReportLogger já está em execução');
      return;
    }

    this.cacheManager = cacheManager;
    this.queue = queue;
    this.isRunning = true;
    this.startTime = Date.now();
    this.reportCount = 0;

    this.logger.info(
      'ReportLogger iniciado',
      this._getStyled('✅ Sistema de relatórios ativo', 'green')
    );

    // Usar TaskQueue para agendamento
    this._scheduleWithTaskQueue();

    // Gerar relatório inicial
    setTimeout(() => this._generateReport(), 1000);
  }

  /**
   * Para o monitoramento
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.taskQueue) {
      // Remover tarefa da TaskQueue se existir
      try {
        this.taskQueue.removeTask?.('reportLogger');
      } catch (error) {
        // Ignorar erros de remoção
      }
    }

    const uptime = this._formatUptime(Date.now() - this.startTime);
    this.logger.info(
      `ReportLogger parado. Uptime: ${uptime}, Relatórios gerados: ${this.reportCount}`
    );
  }

  /**
   * Gera relatório sob demanda
   * @public
   */
  generateReportNow() {
    if (!this.cacheManager || !this.queue) {
      this.logger.warn(
        'Gerenciadores não inicializados. Use start() primeiro.'
      );
      return;
    }

    this._generateReport();
  }

  /**
   * Obtém configurações atuais
   * @public
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Atualiza configurações
   * @public
   */
  updateConfig(newConfig) {
    const oldInterval = this.config.interval;
    this.config = { ...this.config, ...newConfig };

    // Reiniciar se o intervalo mudou e o reporter está ativo
    if (this.isRunning && oldInterval !== this.config.interval) {
      const cacheManager = this.cacheManager;
      const queue = this.queue;
      if (cacheManager && queue) {
        this.stop();
        setTimeout(() => this.start(cacheManager, queue), 100);
      }
    }
  }

  /**
   * Obtém estatísticas do reporter
   * @public
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      reportCount: this.reportCount,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      config: this.getConfig(),
    };
  }

  /**
   * Destrói completamente a instância do ReportLogger
   * Limpa todas as referências, para timers e libera recursos
   * @public
   * @example
   * const reporter = new ReportLogger();
   * reporter.start(cacheManager, queue);
   * // ... uso normal
   * reporter.destroy(); // Limpa tudo e torna a instância inutilizável
   */
  destroy() {
    try {
      // Parar operações se estiver rodando
      if (this.isRunning) {
        this.stop();
      }

      // Log de destruição antes de limpar o logger
      if (this.logger) {
        const uptime = this.startTime
          ? this._formatUptime(Date.now() - this.startTime)
          : '0s';
        this.logger.info(
          this._getStyled(
            `🗑️ ReportLogger destruído. Uptime total: ${uptime}, Relatórios gerados: ${this.reportCount}`,
            'yellow'
          )
        );
      }

      // Limpar todas as referências de objetos externos
      this.cacheManager = null;
      this.queue = null;
      this.taskQueue.destroy();
      this.logger.destroy();

      // Resetar estado
      this.isRunning = false;
      this.reportCount = 0;
      this.startTime = 0;

      // Limpar configurações sensíveis
      this.config = {
        interval: 60000, // 1 minuto
        enableCache: false,
        enableMemory: false,
        enableQueue: false,
        loggerModule: 'REPORTER',
        logLevel: logLevel.INFO,
        showHeader: false,
        useColors: false,
        saveLogs: false,
      };
    } catch (error) {
      // Fallback para console se logger não estiver disponível
      console.error('[REPORTER] Erro durante destruição:', error);
    } finally {
      // Garantir que o objeto esteja marcado como destruído
      this._destroyed = true;
      Object.freeze(this);
    }
  }

  /**
   * Agendamento usando TaskQueue
   * @private
   */
  _scheduleWithTaskQueue() {
    if (!this.taskQueue || typeof this.taskQueue.addTask !== 'function') {
      this.logger.warn('TaskQueue não disponível, usando setInterval');
      return;
    }

    try {
      this.taskQueue.addTask(
        'reportLogger',
        () => this._generateReport(),
        this.config.interval,
        {
          priority: 1,
          onError: (error) => {
            this.logger.error('Erro na geração de relatório:', error);
          },
          debounce: 20000,
        }
      );
    } catch (error) {
      this.logger.error('Erro ao agendar com TaskQueue:', error);
    }
  }

  /**
   * Gera um relatório detalhado com estatísticas do sistema
   *
   * @description Coleta e formata informações sobre cache, memória, fila e status do sistema
   * @returns {void}
   * @private
   */
  _generateReport() {
    if (!this.isRunning) {
      return;
    }
    if (
      !this.cacheManager ||
      this.cacheManager.destroyed ||
      !this.queue ||
      this.queue?.destroyed
    ) {
      this.logger.warn(
        'Gerenciadores não inicializados ou foram destruídos. Use start() primeiro.'
      );
      this.stop();
      return;
    }

    this.reportCount++;
    const timestamp = new Date().toISOString();
    const output = [];

    try {
      if (this.config.showHeader) {
        output.push(this._getHeader(timestamp));
      }

      if (this.config.enableCache && this.cacheManager) {
        output.push(this._getCacheStats());
      }

      if (this.config.enableMemory && this.cacheManager) {
        output.push(this._getMemoryStats());
      }

      if (this.config.enableQueue && this.queue) {
        output.push(this._getQueueStats());
      }

      if (this.reportCount === 1) {
        output.push(this._getReporterStatus());
      }

      output.push(this._getFooter());
    } catch (error) {
      this.logger.error('Erro ao gerar relatório:', error);
    }

    this.logger.info(output.join('\n'));

    if (this.config.saveLogs) {
      this.logger.save(`${this.config.loggerModule}_${this.reportCount}`);
    }
  }

  /**
   * Gera o cabeçalho do relatório com informações de timestamp e contagem
   *
   * @param {string} timestamp - Timestamp do momento da geração do relatório
   * @returns {string} Cabeçalho formatado com estilização visual
   * @private
   */
  _getHeader(timestamp) {
    const uptime = this._formatUptime(Date.now() - this.startTime);
    const header = [
      '',
      '═══════════════════════════════════════════════════════════════',
      `           📊 RELATÓRIO DO SISTEMA #${this.reportCount}`,
      `           🕐 ${timestamp}`,
      `           ⏱️  Uptime: ${uptime}`,
      '═══════════════════════════════════════════════════════════════',
      '',
    ].join('\n');

    return this._getStyled(header, 'section');
  }

  /**
   * Obtém e formata estatísticas detalhadas de todos os caches gerenciados
   *
   * @returns {string} Uma string formatada com informações sobre cada cache,
   * incluindo tamanho, eficiência, taxa de acerto, operações e conteúdo
   * @throws {Error} Lança um erro se houver falha ao recuperar as estatísticas de cache
   * @private
   */
  _getCacheStats() {
    try {
      const globalStats = this.cacheManager?.getStats();

      this.lastStatus.cacheStats ||= {};
      this.lastStatus.cacheStats.caches ||= {};

      const output = [];

      output.push(this._getStyled('🗂️  ESTATÍSTICAS DE CACHE', 'bold'));
      output.push(
        this._getStyled(
          `   Total de Caches: ${globalStats.totalCaches}`,
          'cyan'
        )
      );

      for (const [_, stats] of Object.entries(globalStats.caches || {})) {
        // Inicializa histórico se necessário
        this.lastStatus.cacheStats.caches[stats.name] ||= {
          usage: 0,
          hits: 0,
          misses: 0,
          missesExpired: 0,
          missesCold: 0,
          sets: 0,
          evictions: 0,
          evictionsTTL: 0,
          objectsInCache: 0,
          clonesInCache: 0,
          avgSetLatencyMS: 0,
          maxSetLatencyMS: { key: '', latencyMS: 0 },
        };

        const previous = this.lastStatus.cacheStats.caches[stats.name];
        const usage = this._calculateUsagePercentage(stats.size, stats.maxSize);
        const efficiency = this._calculateCacheEfficiency(stats);

        output.push('');
        output.push(this._getStyled(`   📁 Cache: ${stats.name}`, 'yellow'));

        output.push(
          `      └─ Tamanho: ${stats.size}/${
            stats.maxSize
          } (${usage}%) ${this._getTendency(usage, previous.usage)}`
        );
        previous.usage = usage;

        output.push(
          `      └─ TTL Padrão: ${this._formatTTL(stats.defaultTTL)}`
        );
        output.push(
          `      └─ Taxa de Acerto: ${stats.hitRate} (${efficiency})`
        );

        output.push(`      └─ Operações:`);
        output.push(
          `         └─ ${stats.hits} hits ${this._getTendency(
            stats.hits,
            previous.hits
          )}`
        );
        output.push(
          `         └─ ${stats.misses} misses ${this._getTendency(
            stats.misses,
            previous.misses
          )}`
        );
        output.push(
          `         └─ ${stats.missesExpired} expirados ${this._getTendency(
            stats.missesExpired,
            previous.missesExpired
          )}`
        );
        output.push(
          `         └─ ${stats.missesCold} não encontrados ${this._getTendency(
            stats.missesCold,
            previous.missesCold
          )}`
        );
        output.push(`         └─ ${stats.sets} sets`);
        output.push(
          `            └─ Latência média: ${formatDuration(stats.avgSetLatencyMS)}`
        );
        output.push(
          `            └─ Máxima: ${stats.maxSetLatencyMS.key} (${formatDuration(stats.maxSetLatencyMS.latencyMS)})`
        );
        output.push(`            └─ Ultima set ${stats.lastSetKey}`);

        previous.hits = stats.hits;
        previous.misses = stats.misses;
        previous.missesExpired = stats.missesExpired;
        previous.missesCold = stats.missesCold;
        previous.sets = stats.sets;

        output.push(`      └─ Manutenção:`);
        output.push(`         └─ ${stats.evictionsTTL} removidos por TTL`);
        output.push(`         └─ ${stats.evictions} por limite`);
        output.push(`         └─ ${stats.cleanups} limpezas`);

        output.push(`      └─ Conteúdo:`);
        output.push(
          `         └─ ${stats.objectsInCache} objetos ${this._getTendency(
            stats.objectsInCache,
            previous.objectsInCache
          )}`
        );
        output.push(
          `         └─ ${stats.clonesInCache} clones ${this._getTendency(
            stats.clonesInCache,
            previous.clonesInCache
          )}`
        );

        previous.evictions = stats.evictions;
        previous.evictionsTTL = stats.evictionsTTL;
        previous.objectsInCache = stats.objectsInCache;
        previous.clonesInCache = stats.clonesInCache;
        previous.avgSetLatencyMS = stats.avgSetLatencyMS;
        previous.maxSetLatencyMS = stats.maxSetLatencyMS;
      }

      return output.join('\n');
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de cache:', error);
      return '';
    }
  }

  /**
   * Obtém e formata estatísticas consolidadas de uso de memória para todos os caches
   *
   * @returns {string} Uma string formatada com informações detalhadas sobre o uso de memória,
   * incluindo total de caches, tamanho total, número de entradas e tamanho médio por entrada
   * @throws {Error} Lança um erro se houver falha ao recuperar as estatísticas de memória
   * @private
   */
  _getMemoryStats() {
    try {
      const memoryStats = this.cacheManager?.getConsolidateMemoryStats();
      const consolidate = memoryStats?.consolidate;

      // Garante que lastStatus esteja inicializado
      this.lastStatus.memoryStats ||= {};
      const prev = this.lastStatus.memoryStats;

      const lines = [
        '',
        this._getStyled('💾 USO DE MEMÓRIA CONSOLIDADO', 'bold'),
        this._getStyled(
          `   Total de Caches: ${memoryStats?.totalCaches}`,
          'cyan'
        ),
        `   └─ Tamanho Total: ${
          consolidate?.totalSize
        } bytes ${this._getTendency(
          consolidate?.totalSize ?? 0,
          prev.totalSize ?? 0
        )}`,
        `   └─ Tamanho Estimado: ${consolidate?.estimatedSize}`,
        `   └─ Total de Entradas: ${
          consolidate?.totalEntries
        } ${this._getTendency(
          consolidate?.totalEntries ?? 0,
          prev.totalEntries ?? 0
        )}`,
        `   └─ Entradas de Objetos: ${
          consolidate?.objectEntries
        } ${this._getTendency(
          consolidate?.objectEntries ?? 0,
          prev.objectEntries ?? 0
        )}`,
        `   └─ Entradas Primitivas: ${
          consolidate?.primitiveEntries
        } ${this._getTendency(
          consolidate?.primitiveEntries ?? 0,
          prev.primitiveEntries ?? 0
        )}`,
        `   └─ Tamanho Médio por Entrada: ${consolidate?.averageEntrySize?.toFixed(
          2
        )} bytes ${this._getTendency(
          consolidate?.averageEntrySize ?? 0,
          prev.averageEntrySize ?? 0
        )}`,
      ];

      // Atualiza os valores anteriores
      Object.assign(this.lastStatus.memoryStats, {
        totalSize: consolidate?.totalSize,
        estimatedSize: consolidate?.estimatedSize,
        totalEntries: consolidate?.totalEntries,
        objectEntries: consolidate?.objectEntries,
        primitiveEntries: consolidate?.primitiveEntries,
        averageEntrySize: consolidate?.averageEntrySize,
      });

      return lines.join('\n');
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de memória:', error);
      return '';
    }
  }

  /**
   * Obtém e formata estatísticas detalhadas sobre o status da fila de tarefas
   *
   * @returns {string} Uma string formatada com informações sobre o status da fila,
   * incluindo estado atual, estatísticas de execução, detalhes de tarefas e métricas de desempenho
   * @throws {Error} Lança um erro se houver falha ao recuperar o status da fila
   * @private
   */
  _getQueueStats() {
    try {
      const queueStatus = this.queue.getStatus();
      const output = [];

      output.push('');
      output.push(this._getStyled('⚡ STATUS DA FILA DE TAREFAS', 'bold'));

      const statusIcon = queueStatus.isRunning ? '🟢' : '🔴';
      const statusText = queueStatus.isRunning ? 'ATIVA' : 'PARADA';
      output.push(
        this._getStyled(
          `   ${statusIcon} Status: ${statusText}`,
          queueStatus.isRunning ? 'green' : 'red'
        )
      );
      output.push(
        `   └─ Tarefas: ${queueStatus.totalTasks} total, ${queueStatus.activeTasks} ativas`
      );
      output.push(`   └─ Executando: ${queueStatus.currentlyExecuting}`);
      output.push(
        `   └─ Próxima Execução: ${this._formatNextExecution(
          queueStatus.nextExecutionIn
        )}`
      );
      output.push(`   └─ Heap Size: ${queueStatus.heapSize}`);

      const stats = queueStatus.stats;
      if (stats) {
        output.push('');
        output.push(
          this._getStyled('   📈 ESTATÍSTICAS DETALHADAS', 'magenta')
        );
        output.push(
          `      └─ Execuções: ${stats.totalExecutions} (${stats.totalErrors} erros)`
        );
        output.push(
          `      └─ Puladas por Debounce: ${stats.totalSkippedByDebounce}`
        );
        output.push(
          `      └─ Eficiência do Debounce: ${stats.debounceEfficiency}`
        );
        output.push(
          `      └─ Tempo Médio de Execução: ${stats.avgExecutionTime?.toFixed(
            2
          )}ms`
        );
        output.push(
          `      └─ Uptime da Fila: ${this._formatUptime(
            Date.now() - stats.queueStartTime
          )}`
        );
      }

      const tasks = queueStatus.taskDetails;
      if (tasks && tasks.length > 0) {
        output.push('');
        output.push(this._getStyled('   🔧 TAREFAS PRINCIPAIS', 'gray'));

        tasks.slice(0, 5).forEach((task) => {
          const activeIcon = task.isActive ? '✅' : '⏸️';
          const nextExec = this._formatDuration(task.nextExecutionIn);

          output.push(`      ${activeIcon} ${task.id}`);
          output.push(
            `         └─ Execuções: ${task.executionCount}, Prioridade: ${task.priority}`
          );
          output.push(`         └─ Próxima: ${nextExec}`);

          if (task.debounce?.enabled) {
            output.push(
              `         └─ Debounce: ${task.debounce.time}ms (${
                task.debounce.canCall ? 'pronto' : 'aguardando'
              })`
            );
          }
        });

        if (tasks.length > 5) {
          output.push(`      ... e mais ${tasks.length - 5} tarefas`);
        }
      }

      return output.join('\n');
    } catch (error) {
      this.logger.error('Erro ao obter status da fila:', error);
    }
    return '';
  }

  /**
   * Gera o rodapé do relatório com informações sobre o próximo relatório agendado
   * @returns {string} Rodapé estilizado com o tempo até o próximo relatório
   * @private
   */
  _getFooter() {
    const footer = [
      '',
      '═══════════════════════════════════════════════════════════════',
      `           Próximo relatório em: ${this._formatDuration(
        this.config.interval
      )}`,
      '═══════════════════════════════════════════════════════════════',
      '',
    ].join('\n');

    return this._getStyled(footer, 'subtle');
  }

  /**
   * Gera um relatório detalhado do status atual do ReportLogger
   * Exibe informações sobre o estado do logger, configurações e estatísticas
   *
   * @returns {string} Relatório formatado com status, configurações e métricas do logger
   * @private
   */
  _getReporterStatus() {
    const ReporterStatus = this.getStats();
    const output = [];

    output.push('');
    output.push(
      this._getStyled(`🗒️ STATUS DO ${this.config.loggerModule}`, 'bold')
    );

    const getStatusIcon = (status) =>
      status ? '🟢 Status: ATIVO' : '🔴 Status: PARADA';

    output.push(
      this._getStyled(
        `   ${getStatusIcon(ReporterStatus.isRunning)}`,
        ReporterStatus.isRunning ? 'green' : 'red'
      )
    );

    output.push(`   └─ Relatórios: ${ReporterStatus.reportCount} total`);

    output.push('');
    output.push(this._getStyled(`🔧 CONFIGURAÇÕES`, 'bold'));
    output.push(`   └─ Intervalo: ${ReporterStatus.config.interval}ms`);
    output.push(
      `   └─ Cache: ${getStatusIcon(ReporterStatus.config.enableCache)}`
    );
    output.push(
      `   └─ Memória: ${getStatusIcon(ReporterStatus.config.enableMemory)}`
    );
    output.push(
      `   └─ Fila: ${getStatusIcon(ReporterStatus.config.enableQueue)}`
    );
    output.push(`   └─ Módulo de Log: ${ReporterStatus.config.loggerModule}`);
    output.push(`   └─ Nível de Log: ${ReporterStatus.config.logLevel}`);
    output.push(`   └─ Mostrar Cabeçalho: ${ReporterStatus.config.showHeader}`);
    output.push(`   └─ Usar Cores: ${ReporterStatus.config.useColors}`);
    output.push('');

    return output.join('\n');
  }

  // ========================================
  // MÉTODOS UTILITÁRIOS
  // ========================================

  /**
   * Aplica estilo ao texto se as cores estiverem habilitadas
   * @private
   */
  _getStyled(text, style) {
    if (!this.config.useColors) {
      return text;
    }

    // Verifica se o estilo é válido
    if (typeof logStyles === 'undefined' && !logStyles[style]) {
      return text;
    }

    return logStyles[style](text);
  }

  /**
   * Calcula eficiência do cache
   * @private
   */
  _calculateCacheEfficiency(stats) {
    const total = stats.hits + stats.misses;
    if (total === 0) return 'N/A';

    const hitRate = (stats.hits / total) * 100;

    if (hitRate >= 90) return '🔥 Excelente';
    if (hitRate >= 70) return '✅ Boa';
    if (hitRate >= 50) return '⚠️ Regular';
    return '❌ Ruim';
  }

  /**
   * Calcula porcentagem de uso
   * @private
   */
  _calculateUsagePercentage(current, max) {
    if (max === 0) return 0;
    return Math.round((current / max) * 100);
  }

  /**
   * Formata TTL para leitura humana
   * @private
   */
  _formatTTL(ttl) {
    if (ttl === 0) return 'Permanente';
    if (ttl < 1000) return `${ttl}ms`;
    if (ttl < 60000) return `${Math.round(ttl / 1000)}s`;
    if (ttl < 3600000) return `${Math.round(ttl / 60000)}min`;
    return `${Math.round(ttl / 3600000)}h`;
  }

  /**
   * Formata duração em formato legível
   * @private
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    return `${Math.round(ms / 86400000)}d`;
  }

  /**
   * Formata tempo de uptime
   * @private
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Formata próxima execução
   * @private
   */
  _formatNextExecution(timestamp) {
    if (!timestamp) return 'N/A';

    const now = Date.now();
    const diff = timestamp - now;

    if (diff <= 0) return 'Agora';
    return this._formatDuration(diff);
  }

  /**
   * Retorna a tendência entre dois valores com emoji, descrição e diferença numérica.
   *
   * @param {number} currentValue - Valor atual
   * @param {number} previousValue - Valor anterior
   * @returns {string} Emoji + descrição + diferença (ex: "📈 Alta (+10)")
   */
  _getTendency(currentValue, previousValue) {
    const diff = currentValue - previousValue;

    if (diff > 0) return `📈 Alta (+${diff.toFixed(2)})`;
    if (diff < 0) return `📉 Queda (${diff.toFixed(2)})`;
    return `➖ Estável (0)`;
  }
}

// Exportar para uso em diferentes ambientes
// if (typeof module !== 'undefined' && module.exports) {
module.exports = ReportLogger;
// } else if (typeof window !== 'undefined') {
//   window.ReportLogger = ReportLogger;
// }

/**
 * EXEMPLOS DE USO:
 *
 * // Configuração básica
 * const reporter = new ReportLogger({
 *   interval: 30000, // 30 segundos
 *   enableCache: true,
 *   enableMemory: true,
 *   enableQueue: true
 * });
 *
 * // Iniciar monitoramento
 * reporter.start(cacheManager, queue);
 *
 * // Usar com TaskQueue personalizada
 * const customQueue = createNewTaskQueue({ minTickInterval: 100 });
 * reporter.start(cacheManager, queue, customQueue);
 *
 * // Gerar relatório imediatamente
 * reporter.generateReportNow();
 *
 * // Atualizar configurações
 * reporter.updateConfig({ interval: 60000, useColors: false });
 *
 * // Parar monitoramento
 * reporter.stop();
 *
 * // Configuração avançada
 * const advancedReporter = new ReportLogger({
 *   interval: 120000, // 2 minutos
 *   enableCache: true,
 *   enableMemory: false, // Desabilitar relatório de memória
 *   enableQueue: true,
 *   loggerModule: 'SYSTEM_MONITOR',
 *   showHeader: true,
 *   useColors: true,
 *   saveLogs: true,
 * });
 */
