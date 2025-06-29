/**
 * @fileoverview Módulo de logging avançado com suporte a formatação ANSI, níveis de log configuráveis
 * e formatação inteligente de objetos. Fornece funcionalidades completas para logging estruturado
 * em aplicações Node.js com saída colorizada no terminal.
 * 
 * @author Seu Nome
 * @version 1.0.0
 * @since 2024-01-01
 * 
 * @requires ./utils.js - Utilitários para timestamp e formatação de objetos
 * @requires ../types/log.types.js - Definições de tipos TypeScript/JSDoc
 * 
 * @example
 * // Importação do módulo
 * const { log, logLevel, setLogLevel, logStyles } = require('./logging.js');
 * 
 * // Uso básico
 * log(logLevel.INFO, "Aplicação iniciada");
 * log(logLevel.ERROR, "Erro crítico:", errorObject);
 * 
 * // Configuração de nível
 * setLogLevel(logLevel.DEBUG);
 */

/**
 * @typedef {import('../types/log.types.js').LogStyles} LogStyles
 * @typedef {import('../types/log.types.js').LogLevelValue} LogLevelValue
 * @typedef {import('../types/log.types.js').LogLevels} LogLevels
 */

const { getTimestamp, formatObject } = require('./utils.js');

/**
 * Coleção de funções de estilização para formatação de texto com códigos ANSI.
 * 
 * Cada função aceita uma string e retorna a mesma string envolvida pelos códigos
 * de escape ANSI apropriados para aplicar cores e formatações em terminais compatíveis.
 * 
 * @namespace logStyles
 * @type {LogStyles}
 * 
 * @example
 * // Uso individual
 * console.log(logStyles.green("Sucesso!"));
 * console.log(logStyles.bold("Texto em negrito"));
 * 
 * @example
 * // Uso combinado
 * console.log(logStyles.bold(logStyles.red("Erro crítico!")));
 * 
 * @example
 * // Verificação de suporte ANSI
 * const supportsColor = process.stdout.isTTY && process.env.TERM !== 'dumb';
 * if (supportsColor) {
 *   console.log(logStyles.cyan("Terminal suporta cores"));
 * }
 */
const logStyles = {
  /**
   * Aplica a cor verde ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo verde aplicado.
   */
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  /**
   * Aplica a cor ciano ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo ciano aplicado.
   */
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  /**
   * Aplica a cor amarela ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo amarelo aplicado.
   */
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  /**
   * Aplica a cor magenta ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo magenta aplicado.
   */
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  /**
   * Aplica a cor cinza ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo cinza aplicado.
   */
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  /**
   * Aplica o estilo negrito ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo negrito aplicado.
   */
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  /**
   * Aplica fundo azul e texto branco ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o fundo azul e texto branco aplicados.
   */
  bgBlue: (text) => `\x1b[44m\x1b[37m${text}\x1b[0m`, // Fundo azul com texto branco
  /**
   * Aplica sublinhado ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo sublinhado aplicado.
   */
  underline: (text) => `\x1b[4m${text}\x1b[0m`, // Texto sublinhado
  /**
   * Aplica fundo amarelo e texto preto ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o fundo amarelo e texto preto aplicados.
   */
  highlight: (text) => `\x1b[103m\x1b[30m${text}\x1b[0m`, // Fundo amarelo com texto preto
  /**
   * Aplica um estilo combinado (negrito e ciano) para ser usado em títulos de seção.
   * Reutiliza as funções `bold` e `cyan` já definidas no objeto `logStyles`.
   * @param {string} text - O texto a ser estilizado como seção.
   * @returns {string} O texto com o estilo de seção aplicado.
   */
  section: (text) => logStyles.bold(logStyles.cyan(text)), // Estilo combinado
  /**
   * Aplica a cor vermelha ao texto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O texto com o estilo vermelho aplicado.
   */
  red: (text) => `\x1b[31m${text}\x1b[0m`, // Texto vermelho
  /**
   * Aplica Texto cinza esmaecido com fundo preto.
   * @param {string} text - O texto a ser estilizado.
   * @returns {string} O Texto cinza esmaecido com fundo preto.
   */
  subtle:  (text) => `\x1b[2;37;40m${text}\x1b[0m`,    // 
};

/**
 * Enumeração dos níveis de log disponíveis no sistema.
 * 
 * Define uma hierarquia de severidade onde cada nível possui um valor numérico
 * que permite filtragem de mensagens. Níveis mais altos incluem automaticamente
 * os níveis inferiores.
 * 
 * @enum {LogLevelValue}
 * @readonly
 * @type {LogLevels}
 * 
 * @example
 * // Configuração de nível mínimo
 * setLogLevel(logLevel.WARN); // Exibe apenas WARN e ERROR
 * 
 * @example
 * // Verificação de nível
 * if (getCurrentLogLevel() <= logLevel.DEBUG) {
 *   log(logLevel.DEBUG, "Informação de debug detalhada");
 * }
 */
const logLevel = Object.freeze({
  /** 
   * Nível de depuração detalhada (valor: 0).
   * Para informações técnicas detalhadas, traces e debugging.
   * @type {0}
   */
  DEBUG: 0,

  /** 
   * Nível de informações gerais (valor: 1).
   * Para logs informativos sobre o funcionamento normal do sistema.
   * @type {1}
   */
  INFO: 1,

  /** 
   * Nível de advertências (valor: 2).
   * Para situações que requerem atenção mas não impedem o funcionamento.
   * @type {2}
   */
  WARN: 2,

  /** 
   * Nível de erros críticos (valor: 3).
   * Para falhas críticas, exceções e erros que impedem o funcionamento.
   * @type {3}
   */
  ERROR: 3,
});


/**
 * Configuração de formatação visual para cada nível de log.
 * 
 * Define o estilo visual (cor) e emoji representativo de cada nível,
 * proporcionando identificação rápida da severidade das mensagens.
 * 
 * @typedef {Object} LogFormatConfig
 * @property {Function} style - Função de estilização do logStyles
 * @property {string} emoji - Emoji representativo do nível
 * 
 * @type {Object.<LogLevelValue, LogFormatConfig>}
 * @readonly
 * 
 * @example
 * // Acessar configuração de um nível específico
 * const errorConfig = LogFormat[logLevel.ERROR];
 * console.log(errorConfig.style("Erro")); // Texto com cor magenta
 * console.log(errorConfig.emoji); // "❌"
 */
const LogFormat = Object.freeze({
  [logLevel.DEBUG]: { style: logStyles.green, emoji: '🐛' },
  [logLevel.INFO]: { style: logStyles.cyan, emoji: 'ℹ️' },
  [logLevel.WARN]: { style: logStyles.yellow, emoji: '⚠️' },
  [logLevel.ERROR]: { style: logStyles.magenta, emoji: '❌' },
});

/**
 * Mapeamento de valores numéricos dos níveis para suas representações em string.
 * 
 * Facilita a conversão de níveis numéricos para strings legíveis,
 * especialmente útil para formatação de logs e debugging.
 * 
 * @type {Object.<LogLevels, string>}
 * @readonly
 * 
 * @example
 * // Conversão de nível numérico para string
 * const levelName = LevelToString[logLevel.INFO]; // "INFO"
 * 
 * @example
 * // Uso em debugging
 * console.log(`Nível atual: ${LevelToString[getCurrentLogLevel()]}`);
 */
const LevelToString = Object.freeze({
  /** Representação string do nível DEBUG */
  [logLevel.DEBUG]: 'DEBUG',
  
  /** Representação string do nível INFO */
  [logLevel.INFO]: 'INFO',
  
  /** Representação string do nível WARN */
  [logLevel.WARN]: 'WARN',
  
  /** Representação string do nível ERROR */
  [logLevel.ERROR]: 'ERROR',
});

/**
 * Nível mínimo de log atualmente configurado no sistema.
 * 
 * Controla quais mensagens de log serão exibidas. Apenas mensagens
 * com nível igual ou superior ao valor configurado serão processadas.
 * 
 * @type {LogLevelValue}
 * @private
 * @default logLevel.INFO
 * 
 * @example
 * // Configuração inicial (INFO é o padrão)
 * // Exibe: INFO, WARN, ERROR
 * // Oculta: DEBUG
 */
let CURRENT_LOG_LEVEL = logLevel.INFO;

/**
 * Valida e converte para LogLevelValue
 * @param {0 | 1 | 2 | 3} value - Valor numérico do nível de log
 * @returns {boolean} - Retorna true se o valor for válido, caso contrário, lança um erro.
 * @throws {Error} Se valor inválido
 */
function toLogLevelValue(value) {
  // Validação rigorosa do nível fornecido usando os valores literais permitidos
  const validLevels = Object.values(logLevel);
  if (validLevels.includes(value)) {
    return true;
  }
  throw new Error(`Valor inválido para nível de log: ${value}`);
}

/**
 * Configura o nível mínimo de log a ser exibido no console.
 * 
 * Define o threshold de severidade para filtragem de mensagens.
 * Apenas logs com nível igual ou superior ao configurado serão exibidos.
 * Inclui validação de entrada para prevenir configurações inválidas.
 * 
 * @function
 * @param {LogLevelValue} level - Novo nível mínimo de log
 * @throws {void} Não lança exceções, mas emite warning para valores inválidos
 * 
 * @example
 * // Configurar para mostrar apenas erros
 * setLogLevel(logLevel.ERROR);
 * 
 * @example
 * // Habilitar modo debug (mostra todos os logs)
 * setLogLevel(logLevel.DEBUG);
 * 
 * @example
 * // Configuração dinâmica baseada em ambiente
 * const isDevelopment = process.env.NODE_ENV === 'development';
 * setLogLevel(isDevelopment ? logLevel.DEBUG : logLevel.WARN);
 * 
 * @since 1.0.0
 */
const setLogLevel = (level) => {
  
  if (toLogLevelValue(level)) {
    CURRENT_LOG_LEVEL = level;
  } else {
    const previousLevel = CURRENT_LOG_LEVEL;
    console.warn(
      `⚠️  Nível de log inválido: ${level}. Mantendo nível atual: ${LevelToString[previousLevel]}`
    );
  }
};

/**
 * Função principal de logging com formatação avançada e suporte a múltiplos tipos de dados.
 * 
 * Registra mensagens no console com formatação personalizada, incluindo:
 * - Timestamp automático
 * - Colorização baseada no nível
 * - Formatação inteligente de objetos
 * - Suporte a estilos customizados
 * - Filtragem por nível de severidade
 * 
 * A função processa argumentos de forma inteligente, separando strings de objetos
 * para aplicar formatação apropriada a cada tipo de dado.
 * 
 * @function
 * @param {LogLevelValue} level - Nível de severidade da mensagem
 * @param {...*} args - Argumentos variados (strings, objetos, funções de estilo)
 * @returns {void}
 * 
 * @example
 * // Uso básico com diferentes níveis
 * log(logLevel.INFO, "Aplicação iniciada");
 * log(logLevel.WARN, "Aviso: configuração não encontrada");
 * log(logLevel.ERROR, "Falha na conexão com banco de dados");
 * log(logLevel.DEBUG, "Variável x =", x);
 * 
 * @example
 * // Logging de objetos complexos
 * const user = { id: 1, name: "João", profile: { role: "admin" } };
 * log(logLevel.INFO, "Usuário autenticado:", user);
 * 
 * @example
 * // Múltiplos argumentos mistos
 * const error = new Error("Timeout");
 * log(logLevel.ERROR, "Falha na operação:", { userId: 123, operation: "save" }, error);
 * 
 * @example
 * // Estilos customizados
 * log(logLevel.INFO, "Mensagem importante", logStyles.bold);
 * log(logLevel.WARN, "Atenção especial", logStyles.highlight);
 * 
 * @example
 * // Função de estilo personalizada
 * const customStyle = (text) => `🔥 ${logStyles.red(text)} 🔥`;
 * log(logLevel.ERROR, "Erro crítico", customStyle);
 * 
 * @example
 * // Logging condicional baseado em nível
 * if (process.env.NODE_ENV === 'development') {
 *   log(logLevel.DEBUG, "Dados de debug:", { request, response });
 * }
 * 
 * @example
 * // Arrays e estruturas complexas
 * const complexData = {
 *   users: [{ id: 1 }, { id: 2 }],
 *   metadata: { timestamp: Date.now(), version: "1.0" },
 *   errors: [new Error("Erro 1"), new Error("Erro 2")]
 * };
 * log(logLevel.DEBUG, "Estado da aplicação:", complexData);
 * 
 * @since 1.0.0
 */
const log = (level, ...args) => {
  if (level < CURRENT_LOG_LEVEL || !LogFormat[level]) return;

  let style = LogFormat[level].style;
  const emoji = LogFormat[level].emoji;

  // Detecta e remove estilo customizado, se houver
  const lastArg = args[args.length - 1];
  if (
    typeof lastArg === 'function' ||
    (typeof lastArg === 'string' && logStyles[lastArg])
  ) {
    style = typeof lastArg === 'string' ? logStyles[lastArg] : lastArg;
    args.pop(); // remove o estilo da lista de mensagens
  }

  const timestamp = getTimestamp();

  const levelStr = LevelToString[level];
  const header = `[${timestamp}] [${levelStr}] ${emoji}`;

  // Separa strings de objetos para formatação diferenciada
  const stringArgs = [];
  const objectArgs = [];

  args.forEach((arg) => {
    if (
      typeof arg === 'string' ||
      typeof arg === 'number' ||
      typeof arg === 'boolean'
    ) {
      stringArgs.push(String(arg));
    } else if (arg !== null && arg !== undefined) {
      objectArgs.push(arg);
    } else {
      stringArgs.push(String(arg)); // null, undefined
    }
  });

  // Monta a mensagem principal com strings
  const mainMessage =
    stringArgs.length > 0 ? `${header} ${stringArgs.join(' ')}` : header;

  // Exibe a mensagem principal com estilo
  console.log(style(mainMessage));

  // Exibe objetos formatados separadamente, se houver
  if (objectArgs.length > 0) {
    objectArgs.forEach((obj) => {
      console.log(style('  └─ Object:'));

      // Usa a função formatObject para formatação consistente
      const formattedObj = formatObject(obj);

      // Adiciona indentação a cada linha do objeto formatado
      const indentedObj = formattedObj
        .split('\n')
        .map((line) => '    ' + line)
        .join('\n');

      console.log(indentedObj);
    });
  }
};

module.exports = {
  logStyles,
  logLevel,
  log,
  setLogLevel,
  LogFormat,
  LevelToString,
  toLogLevelValue,
};
