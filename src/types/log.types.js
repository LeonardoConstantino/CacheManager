/**
 * Conjunto de funções para estilização de texto em logs do terminal
 * @typedef {Object} LogStyles
 * @property {function(string): string} green - Aplica cor verde ao texto
 * @property {function(string): string} cyan - Aplica cor ciano ao texto
 * @property {function(string): string} yellow - Aplica cor amarela ao texto
 * @property {function(string): string} magenta - Aplica cor magenta ao texto
 * @property {function(string): string} gray - Aplica cor cinza ao texto
 * @property {function(string): string} bold - Aplica estilo negrito ao texto
 * @property {function(string): string} bgBlue - Aplica fundo azul com texto branco
 * @property {function(string): string} underline - Aplica sublinhado ao texto
 * @property {function(string): string} highlight - Aplica fundo amarelo com texto preto
 * @property {function(string): string} section - Combina negrito e ciano para títulos
 * @property {function(string): string} red - Aplica cor vermelha ao texto
 * @property {function(string): string} subtle - Aplica texto cinza esmaecido com fundo preto
 */

/**
 * Tipo para valores numéricos válidos de nível de log.
 * 
 * Representa os valores literais aceitos para definir a severidade
 * de uma mensagem de log. Cada valor corresponde a um nível específico
 * na hierarquia de logging.
 * 
 * @typedef {0 | 1 | 2 | 3} LogLevelValue
 * 
 * @example
 * // Uso em validação
 * function isValidLogLevel(level) {
 *   return [0, 1, 2, 3].includes(level);
 * }
 * 
 * @example
 * // Declaração de variável
 * /** @type {LogLevelValue} *\/
 * const currentLevel = 1;
 */

/**
 * Objeto enumerado contendo os níveis de log disponíveis no sistema.
 * 
 * Define uma estrutura imutável com todos os níveis de severidade
 * suportados pelo sistema de logging. Cada propriedade mapeia para
 * um valor numérico que determina a hierarquia de importância.
 * 
 * @readonly
 * @typedef {Object} LogLevels
 * 
 * @property {0} DEBUG - Nível para mensagens detalhadas de depuração e debugging
 * @property {1} INFO - Nível para informações gerais de operação e status
 * @property {2} WARN - Nível para advertências e problemas não críticos
 * @property {3} ERROR - Nível para erros críticos, exceções e falhas do sistema
 * 
 * @example
 * // Implementação típica do LogLevels
 * /** @type {LogLevels} *\/
 * const logLevel = Object.freeze({
 *   DEBUG: 0,
 *   INFO: 1,
 *   WARN: 2,
 *   ERROR: 3
 * });
 * 
 * @example
 * // Uso em comparações de severidade
 * function shouldLog(messageLevel, currentLevel) {
 *   return messageLevel >= currentLevel;
 * }
 * 
 * @example
 * // Iteração sobre níveis
 * Object.entries(logLevel).forEach(([name, value]) => {
 *   console.log(`${name}: ${value}`);
 * });
 * 
 * @see {@link LogLevelValue} Para os valores literais aceitos
 */

module.exports = {};