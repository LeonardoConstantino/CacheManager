/**
 * @typedef {import('../types/log.types.js').LogLevels} LogLevels
 * @typedef {import('../types/log.types.js').LogLevelValue} LogLevelValue
 */

/**
 * @fileoverview Classe Logger modular com isolamento de níveis de log por instância.
 * VERSÃO OTIMIZADA - Salvamento apenas manual via método save()
 *
 * Mudanças implementadas:
 * - Removido salvamento automático ao atingir limite do buffer
 * - Buffer circular com limite configurável (descarta logs antigos quando cheio)
 * - Salvamento apenas via chamada explícita do método save()
 * - Performance otimizada mantendo interface original
 *
 * @author Leonardo H. Constantino
 * @version 1.2.0 (Manual Save Only)
 * @since 2024-01-01
 */

const {
  logLevel,
  logStyles,
  LogFormat,
  LevelToString,
  toLogLevelValue,
} = require('../utils/log.js');
const { getTimestamp, formatObject } = require('../utils/utils.js');
const { Timer } = require('../utils/Timers.js');
const fs = require('fs');
const path = require('path');

/**
 * Implementa um buffer circular com tamanho máximo predefinido.
 *
 * @class CircularLogBuffer
 * @description Gerencia um buffer de tamanho fixo que sobrescreve elementos mais antigos quando atinge o limite máximo.
 * Útil para armazenamento eficiente de logs e outros dados com limite de memória.
 */
class CircularLogBuffer {
  /**
   * Construtor do buffer circular.
   *
   * @constructor
   * @description Inicializa um buffer circular com tamanho máximo predefinido.
   * @param {number} maxSize - Tamanho máximo do buffer circular.
   * @property {Array} buffer - Array que armazena os elementos do buffer.
   * @property {number} head - Índice do primeiro elemento do buffer.
   * @property {number} tail - Índice onde o próximo elemento será inserido.
   * @property {number} count - Número atual de elementos no buffer.
   * @property {number} maxSize - Tamanho máximo configurado para o buffer.
   */
  constructor(maxSize) {
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.maxSize = maxSize;
  }

  /**
   * Adiciona um novo item ao buffer circular.
   *
   * @method push
   * @description Insere um item no buffer, sobrescrevendo o item mais antigo quando o buffer está cheio.
   * @param {*} item - O item a ser adicionado ao buffer.
   */
  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;

    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // Buffer cheio: avança head (descarta item mais antigo)
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  /**
   * Drena todos os itens atuais do buffer circular.
   *
   * @method drain
   * @description Remove e retorna todos os itens do buffer, esvaziando-o completamente.
   * @returns {Array} Uma matriz com todos os itens que estavam no buffer, na ordem de inserção.
   */
  drain() {
    const items = [];
    while (this.count > 0) {
      items.push(this.buffer[this.head]);
      this.head = (this.head + 1) % this.maxSize;
      this.count--;
    }
    return items;
  }

  /**
   * Retorna uma cópia dos itens do buffer circular sem removê-los.
   *
   * @method peek
   * @description Permite visualizar o conteúdo atual do buffer sem modificá-lo.
   * @returns {Array} Uma matriz com todos os itens atualmente no buffer, mantendo a ordem de inserção.
   */
  peek() {
    const items = [];
    let currentHead = this.head;
    let remaining = this.count;

    while (remaining > 0) {
      items.push(this.buffer[currentHead]);
      currentHead = (currentHead + 1) % this.maxSize;
      remaining--;
    }
    return items;
  }

  /**
   * Retorna o número atual de itens no buffer circular.
   *
   * @method length
   * @description Fornece a quantidade de elementos atualmente armazenados no buffer.
   * @returns {number} Número de itens no buffer.
   */
  get length() {
    return this.count;
  }
  /**
   * Verifica se o buffer circular está vazio.
   *
   * @method isEmpty
   * @description Indica se não há elementos armazenados no buffer.
   * @returns {boolean} Retorna true se o buffer não contém nenhum item, false caso contrário.
   */
  get isEmpty() {
    return this.count === 0;
  }
  /**
   * Verifica se o buffer circular está completamente preenchido.
   *
   * @method isFull
   * @description Indica se o buffer atingiu sua capacidade máxima.
   * @returns {boolean} Retorna true se o número de itens no buffer for igual ou maior que o tamanho máximo, false caso contrário.
   */
  get isFull() {
    return this.count >= this.maxSize;
  }

  /**
   * Limpa completamente o buffer circular, redefinindo todos os ponteiros e contadores para o estado inicial.
   *
   * @method clear
   * @description Reseta o buffer, removendo todos os itens armazenados e preparando-o para um novo uso.
   */
  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

/**
 * Enumeração que representa os possíveis estados de um Logger.
 *
 * @description Define os estados que um objeto Logger pode assumir durante seu ciclo de vida.
 *
 * @enum {string}
 * @property {string} ACTIVE - Estado padrão, indica que o logger está ativo e funcionando normalmente.
 * @property {string} SAVING - Indica que o logger está no processo de salvar logs.
 * @property {string} DESTROYED - Indica que o logger foi completamente destruído e não pode mais ser utilizado.
 * @property {string} ERROR - Indica que o logger encontrou um estado de erro e não está funcionando corretamente.
 */
const LoggerState = {
  ACTIVE: 'active',
  SAVING: 'saving',
  DESTROYED: 'destroyed',
  ERROR: 'error',
};

/**
 * Representa um buffer circular para gerenciamento de logs com capacidade máxima definida.
 *
 * @class Logger
 * @description Classe principal de gerenciamento de logs com recursos avançados como buffer circular,
 * níveis de log, salvamento automático e manual, e tratamento de estado.
 *
 * @property {LogLevelValue} logLevel - Nível mínimo de log permitido para esta instância
 * @property {string} label - Rótulo/identificador para prefixar as mensagens de log
 * @property {number} maxBufferSize - Tamanho máximo do buffer de logs
 *
 * @example
 * // Criação de um logger básico
 * const logger = new Logger('SISTEMA', logLevel.INFO);
 *
 * @example
 * // Logger para desenvolvimento com logs detalhados
 * const devLogger = new Logger('DEV', logLevel.DEBUG);
 */
class Logger {
  /**
   * Cria uma nova instância do Logger com configurações isoladas.
   *
   * @constructor
   * @param {string} [label=''] - Identificador/rótulo para os logs desta instância.
   *                              Será prefixado em todas as mensagens de log.
   * @param {LogLevelValue} [level=logLevel.INFO] - Nível mínimo de log permitido para esta instância. Apenas logs com nível igual ou superior serão exibidos.
   *
   * @param {number} [maxBufferSize=1000] - Tamanho máximo do buffer interno.
   *
   * @throws {Error} Lança erro se a classe Timer não estiver disponível ou for inválida
   *
   * @example
   * // Logger básico sem rótulo
   * const logger = new Logger();
   *
   * @example
   * // Logger com rótulo e nível específico
   * const dbLogger = new Logger('DB-CONNECTOR', logLevel.DEBUG);
   *
   * @example
   * // Logger para produção (apenas warnings e erros)
   * const prodLogger = new Logger('PROD', logLevel.WARN);
   *
   * @example
   * // Tratamento de erro na criação
   * try {
   *   const logger = new Logger('TEST');
   * } catch (error) {
   *   console.error('Falha ao criar logger:', error.message);
   * }
   *
   * @since 1.0.0
   */
  constructor(label = '', level = logLevel.INFO, maxBufferSize = 1000) {
    if (typeof Timer !== 'function') {
      throw new Error('Logger requer uma classe Timer válida.');
    }

    // Configuração original mantida
    this.logLevel = level;
    this.label = label !== '' ? `${label} ->\n` : '';
    this._TimerClass = Timer;
    this.maxBufferSize = maxBufferSize;
    this._fileCounter = 1;
    this._isDestroyed = false;

    // === CONFIGURAÇÃO OTIMIZADA ===

    // Buffer circular com limite fixo (não aciona salvamento automático)
    this._logBuffer = new CircularLogBuffer(maxBufferSize);

    // Controle de estado
    this._state = LoggerState.ACTIVE;

    // Write streams reutilizáveis para melhor performance
    this._writeStreams = new Map();
    this._logDir = path.join(process.cwd(), '.generated/logs');

    // Sistema de retry para salvamentos manuais
    this._retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };

    // Flag de controle para salvamentos
    this._isSaving = false;

    // Interface original mantida
    this._log = this._createInstanceLogger();

    // Métodos de conveniência (interface original mantida)
    this.debug = (msg, ...args) => this._log(logLevel.DEBUG, msg, ...args);
    this.info = (msg, ...args) => this._log(logLevel.INFO, msg, ...args);
    this.warn = (msg, ...args) => this._log(logLevel.WARN, msg, ...args);
    this.error = (msg, ...args) => this._log(logLevel.ERROR, msg, ...args);
    this.custom = (msg, ...args) => this._log(logLevel.INFO, msg, ...args);

    // Inicializa diretório de logs
    this._ensureLogDirectory();
  }

  /**
   * Define o nível de log para o logger atual.
   *
   * @param {LogLevelValue} level - O novo nível de log a ser definido.
   * @throws {TypeError} Se o nível de log fornecido for inválido.
   * @description Atualiza o nível de log do logger, permitindo apenas níveis predefinidos.
   * Não tem efeito se o logger já foi destruído.
   */
  setLogLevel(level) {
    if (this._state === LoggerState.DESTROYED) {
      console.warn('Operação ignorada: Logger foi destruído');
      return;
    }

    const validLevels = [
      logLevel.DEBUG,
      logLevel.INFO,
      logLevel.WARN,
      logLevel.ERROR,
    ];
    if (!validLevels.includes(level)) {
      throw new TypeError(
        `Nível de log inválido: ${level}. Deve ser um dos valores: ${validLevels.join(
          ', '
        )}`
      );
    }

    this.logLevel = level;
  }

  /**
   * Cria uma instância de Timer para medição de tempo de execução.
   *
   * @param {string} name - Nome identificador para o timer.
   * @param {LogLevelValue} [level=logLevel.INFO] - Nível de log para o timer (padrão: INFO).
   * @returns {Timer} Instância de Timer para medição de tempo.
   * @description Cria um novo timer para monitoramento de desempenho, respeitando o estado atual do logger.
   * Se o logger estiver destruído, retorna um timer dummy.
   */
  Timer(name, level = logLevel.INFO) {
    if (this._state === LoggerState.DESTROYED) {
      console.warn('Chamada ignorada: Timer() em logger destruído');
      return new this._TimerClass('dummy-destroyed');
    }

    const validLevel = toLogLevelValue(level) ? logLevel.INFO : level;
    return new this._TimerClass(name, validLevel);
  }

  /**
   * Salva os logs do buffer em um arquivo, com tratamento de estado e recuperação.
   *
   * @param {string} [filename] - Nome opcional do arquivo de log. Se não fornecido, gera um nome automaticamente.
   * @returns {Promise<void>} Promessa que resolve quando o salvamento é concluído.
   * @throws {Error} Lança erro em caso de falha crítica no salvamento.
   * @description Método que gerencia o salvamento de logs, lidando com estados do logger,
   * prevenindo salvamentos simultâneos e implementando mecanismo de retry e auto-recuperação.
   * Suporta salvamento manual (com filename) e nome automático.
   */
  async save(filename) {
    if (this._state === LoggerState.DESTROYED) {
      console.warn('Chamada ignorada: save() em logger destruído');
      return;
    }

    // Se já está salvando, aguarda conclusão
    if (this._isSaving) {
      return new Promise((resolve) => {
        const checkSaving = () => {
          if (!this._isSaving) {
            //@ts-ignore
            resolve();
          } else {
            setTimeout(checkSaving, 50);
          }
        };
        checkSaving();
      });
    }

    // Se buffer está vazio, não há nada para salvar
    if (this._logBuffer.isEmpty) {
      console.log('Buffer vazio - nenhum log para salvar');
      return;
    }

    this._isSaving = true;
    this._state = LoggerState.SAVING;

    try {
      // Drena todos os logs do buffer
      const logsToSave = this._logBuffer.drain();

      if (logsToSave.length === 0) {
        console.log('Nenhum log disponível para salvamento');
        return;
      }

      const finalFilename = filename || this._getNumberedFilename();
      const success = await this._saveWithRetry(logsToSave, finalFilename);

      if (success) {
        // Incrementa contador apenas para salvamentos automáticos (sem filename)
        if (!filename) this._fileCounter++;
        this._state = LoggerState.ACTIVE;
        console.log(
          `Logs salvos com sucesso: ${finalFilename}.log (${logsToSave.length} entradas)`
        );
      } else {
        // Em caso de falha total, restaura logs no buffer
        this._restoreLogsToBuffer(logsToSave);
        this._state = LoggerState.ERROR;
        throw new Error('Falha ao salvar logs após todas as tentativas');
      }
    } catch (error) {
      this._state = LoggerState.ERROR;
      console.error('Erro crítico ao salvar logs:', error);
      throw error;
    } finally {
      this._isSaving = false;

      // Auto-recovery de estado de erro
      if (this._state === LoggerState.ERROR) {
        setTimeout(() => {
          if (this._state === LoggerState.ERROR) {
            this._state = LoggerState.ACTIVE;
          }
        }, 5000);
      }
    }
  }

  /**
   * Descarta todos os logs atualmente no buffer
   *
   * @returns {string} Logs descartados concatenados em uma única string, ou string vazia se não houver logs
   * @description Remove todos os logs do buffer e retorna seu conteúdo. Se o logger já estiver destruído, emite um aviso.
   */
  discardLogs() {
    if (this._state === LoggerState.DESTROYED) {
      console.warn('Operação ignorada: discardLogs() em logger destruído');
      return '';
    }
    // Drena todos os logs do buffer
    const logsToDiscard = this._logBuffer.drain();

    if (logsToDiscard.length === 0) {
      console.log('Nenhum log disponível para descarte');
      return '';
    }

    return logsToDiscard.join('\n') + '\n';
  }

  /**
   * Obtém o status atual do buffer de logs
   *
   * @returns {Object} Objeto com informações sobre o estado do buffer
   * @property {number} count - Número atual de logs no buffer
   * @property {number} maxSize - Tamanho máximo configurado para o buffer
   * @property {boolean} isFull - Indica se o buffer está completamente preenchido
   * @property {boolean} isEmpty - Indica se o buffer está vazio
   * @property {number} percentageFull - Porcentagem de preenchimento do buffer (0-100)
   */
  getBufferStatus() {
    if (this._state === LoggerState.DESTROYED) {
      return { count: 0, maxSize: 0, isFull: false, isEmpty: true };
    }

    return {
      count: this._logBuffer.length,
      maxSize: this.maxBufferSize,
      isFull: this._logBuffer.isFull,
      isEmpty: this._logBuffer.isEmpty,
      percentageFull: Math.round(
        (this._logBuffer.length / this.maxBufferSize) * 100
      ),
    };
  }

  /**
   * Visualiza os logs mais recentes no buffer
   *
   * @param {number} [lastN=10] - Número de logs mais recentes a serem retornados
   * @returns {Array} Lista de logs do buffer, limitada aos últimos N logs
   * @description Retorna os logs mais recentes do buffer, com opção de limitar a quantidade
   */
  previewBuffer(lastN = 10) {
    if (this._state === LoggerState.DESTROYED) {
      return [];
    }

    const allLogs = this._logBuffer.peek();
    return lastN > 0 ? allLogs.slice(-lastN) : allLogs;
  }

  /**
   * Destrói completamente a instância do Logger, liberando todos os recursos
   *
   * @description Realiza a limpeza completa do logger, incluindo:
   * - Marca o estado como destruído
   * - Cancela salvamentos pendentes
   * - Fecha todos os write streams
   * - Limpa o buffer de logs
   * - Reseta o contador de arquivos
   * - Invalida todos os métodos de log
   * - Remove referências internas
   *
   * @returns {void}
   */
  destroy() {
    // Marca como destruído imediatamente
    this._state = LoggerState.DESTROYED;
    this._isDestroyed = true;

    // Cancela salvamentos pendentes
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }

    // Fecha todos os write streams
    for (const [path, stream] of this._writeStreams) {
      try {
        stream.end();
      } catch (error) {
        console.warn(`Erro ao fechar stream ${path}:`, error.message);
      }
    }
    this._writeStreams.clear();

    // Limpa buffer
    this._logBuffer.clear();
    //@ts-ignore
    this._logBuffer = null;

    // Reseta contador
    this._fileCounter = 1;

    // Invalida métodos (interface original mantida)
    this.debug = () => {};
    this.info = () => {};
    this.warn = () => {};
    this.error = () => {};
    this.custom = () => {};
    this._log = () => {};

    // Limpa referências
    //@ts-ignore
    this._TimerClass = null;
    this.label = '[DESTROYED]';

    console.log('Logger destruído e recursos liberados');
  }

  /**
   * Cria uma instância de logger personalizada com tratamento avançado de logs
   *
   * @private
   * @returns {Function} Função de log que processa mensagens com diferentes níveis e formatos
   * @description Gera um logger interno que:
   * - Filtra logs por nível
   * - Adiciona timestamp e emoji
   * - Formata mensagens e objetos
   * - Gerencia buffer de logs
   * - Emite alertas quando o buffer está próximo do limite
   */
  _createInstanceLogger() {
    return (msgLevel, ...args) => {
      // Verificação rápida de estado
      if (
        this._state === LoggerState.DESTROYED ||
        msgLevel < this.logLevel ||
        !LogFormat[msgLevel]
      ) {
        return;
      }

      let style = LogFormat[msgLevel].style;
      const emoji = LogFormat[msgLevel].emoji;

      // Processamento de argumentos
      const lastArg = args[args.length - 1];
      if (
        typeof lastArg === 'function' ||
        (typeof lastArg === 'string' && logStyles[lastArg])
      ) {
        style = typeof lastArg === 'string' ? logStyles[lastArg] : lastArg;
        args.pop();
      }

      const timestamp = getTimestamp();
      const levelStr = LevelToString[msgLevel];
      const header = `[${timestamp}] [${levelStr}] ${emoji} ${this.label}`;

      // Separação de argumentos
      const stringArgs = [];
      const objectArgs = [];

      for (const arg of args) {
        if (
          typeof arg === 'string' ||
          typeof arg === 'number' ||
          typeof arg === 'boolean'
        ) {
          stringArgs.push(String(arg));
        } else if (arg != null) {
          objectArgs.push(arg);
        } else {
          stringArgs.push(String(arg));
        }
      }

      const mainMessage =
        stringArgs.length > 0 ? `${header}${stringArgs.join(' ')}` : header;

      // Armazena no buffer (sem códigos ANSI)
      const cleanLogEntry = this._removeANSI(mainMessage);
      this._logBuffer.push(cleanLogEntry); // APENAS ADICIONA NO BUFFER - SEM TRIGGER

      // Saída no console
      console.log(style(mainMessage));

      // Processa objetos se existirem
      if (objectArgs.length > 0) {
        for (const obj of objectArgs) {
          const ident = '  └─ Object:';
          const cleanIdent = this._removeANSI(ident);
          this._logBuffer.push(cleanIdent);
          console.log(style(ident));

          const formatted = formatObject(obj);
          const formattedLines = formatted
            .split('\n')
            .map((line) => '    ' + line)
            .join('\n');
          this._logBuffer.push(formattedLines);
          console.log(formattedLines);
        }
      }

      // AVISO OPCIONAL: Se buffer estiver quase cheio
      if (this._logBuffer.length >= this.maxBufferSize * 0.9) {
        console.warn(
          `⚠️  Buffer do Logger quase cheio (${this._logBuffer.length}/${this.maxBufferSize}). Considere chamar save().`
        );
      }
    };
  }

  /**
   * Garante que o diretório de logs exista, criando-o recursivamente se não estiver presente.
   * Se a criação do diretório falhar, registra um aviso no console.
   *
   * @private
   * @method _ensureLogDirectory
   */
  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this._logDir)) {
        fs.mkdirSync(this._logDir, { recursive: true });
      }
    } catch (error) {
      console.warn(
        'Aviso: Não foi possível criar diretório de logs:',
        error.message
      );
    }
  }

  /**
   * Tenta salvar logs com mecanismo de retry e backoff exponencial.
   *
   * @private
   * @async
   * @method _saveWithRetry
   * @param {Array} logs - Lista de logs para salvar
   * @param {string} filename - Nome do arquivo de log
   * @returns {Promise<boolean>} Indica se o salvamento foi bem-sucedido
   *
   * @description
   * Realiza múltiplas tentativas de salvamento de logs com estratégia de retry.
   * Em caso de falha, aplica backoff exponencial com limite máximo de tentativas.
   * Registra avisos e erros durante o processo de salvamento.
   */
  async _saveWithRetry(logs, filename) {
    let lastError = null;

    for (let attempt = 1; attempt <= this._retryConfig.maxAttempts; attempt++) {
      try {
        await this._writeLogsToFile(logs, filename);
        return true; // Sucesso
      } catch (error) {
        lastError = error;

        if (attempt === this._retryConfig.maxAttempts) {
          console.error(
            `Falha ao salvar logs após ${this._retryConfig.maxAttempts} tentativas:`,
            error
          );
          return false; // Falha total
        }

        // Exponential backoff
        const delay = Math.min(
          this._retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this._retryConfig.maxDelay
        );

        console.warn(
          `Tentativa ${attempt} falhou, tentando novamente em ${delay}ms:`,
          error.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  /**
   * Grava logs em um arquivo de log específico usando um stream de escrita.
   *
   * @private
   * @async
   * @method _writeLogsToFile
   * @param {Array} logs - Lista de logs para gravar
   * @param {string} filename - Nome base do arquivo de log
   * @returns {Promise<void>} Promessa que resolve quando os logs são gravados com sucesso
   *
   * @description
   * Gerencia streams de escrita para arquivos de log, reutilizando streams existentes
   * e criando novos quando necessário. Grava os logs em modo de anexação (append).
   * Em caso de erro na gravação, remove o stream e rejeita a promessa.
   */
  async _writeLogsToFile(logs, filename) {
    const filePath = path.join(this._logDir, `${filename}.log.txt`);

    // Reutiliza write stream se possível
    if (!this._writeStreams.has(filePath)) {
      this._writeStreams.set(
        filePath,
        fs.createWriteStream(filePath, { flags: 'a' })
      );
    }

    const stream = this._writeStreams.get(filePath);
    const content = logs.join('\n') + '\n';

    return new Promise((resolve, reject) => {
      stream.write(content, (error) => {
        if (error) {
          // Remove stream com falha
          this._writeStreams.delete(filePath);
          stream.destroy();
          reject(error);
        } else {
          //@ts-ignore
          resolve();
        }
      });
    });
  }

  /**
   * Restaura logs no buffer após uma falha no salvamento.
   *
   * @private
   * @method _restoreLogsToBuffer
   * @param {Array} logs - Lista de logs a serem restaurados
   *
   * @description
   * Adiciona logs ao buffer circular após uma falha no processo de salvamento.
   * Os logs são adicionados em ordem reversa e podem ser descartados se o buffer
   * atingir seu limite máximo.
   */
  _restoreLogsToBuffer(logs) {
    // Em caso de falha no save, restaura logs no buffer
    // Como é buffer circular, logs podem ser descartados se exceder limite
    for (const log of logs.reverse()) {
      this._logBuffer.push(log);
    }
    console.warn(
      `Logs restaurados no buffer após falha no salvamento (${logs.length} entradas)`
    );
  }

  /**
   * Remove códigos ANSI de formatação de texto.
   *
   * @private
   * @method _removeANSI
   * @param {string} text - Texto com possíveis códigos ANSI
   * @returns {string} Texto sem formatações ANSI
   *
   * @description
   * Remove códigos de escape ANSI que controlam formatação de texto no terminal,
   * como cores e estilos, retornando apenas o texto puro.
   */
  _removeANSI(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Sanitiza o rótulo do logger para uso em nomes de arquivos.
   *
   * @private
   * @method _getSanitizedLabel
   * @returns {string} Rótulo sanitizado e formatado
   *
   * @description
   * Converte o rótulo do logger em um nome de arquivo válido e legível.
   * Remove caracteres especiais, substitui espaços e hífens por underscores,
   * limita o comprimento para 50 caracteres e converte para minúsculas.
   * Se nenhum rótulo for fornecido, retorna 'logs' como padrão.
   */
  _getSanitizedLabel() {
    if (!this.label || this.label.trim() === '') {
      return 'logs';
    }

    return this.label
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .substring(0, 50)
      .toLowerCase();
  }

  /**
   * Gera um nome de arquivo numerado com base no rótulo sanitizado.
   *
   * @private
   * @method _getNumberedFilename
   * @returns {string} Nome de arquivo com rótulo sanitizado e contador
   *
   * @description
   * Cria um nome de arquivo único usando o rótulo sanitizado do logger
   * e um contador incremental para evitar sobrescrita de arquivos.
   */
  _getNumberedFilename() {
    const baseName = this._getSanitizedLabel();
    return `${baseName}_${this._fileCounter}`;
  }
}

module.exports = Logger;
