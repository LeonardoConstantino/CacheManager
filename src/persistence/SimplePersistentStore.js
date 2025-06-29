const {MinimalPersistence} = require('./MinimalPersistence');
const Logger = require('../logger/Logger');

/**
 * @class SimplePersistentStore
 * @description Uma versão simplificada de um armazenamento persistente de chave-valor com suporte a TTL (Time-To-Live),
 * ideal para casos onde um sistema de cache completo não é necessário.
 */
class SimplePersistentStore {
  /** @type {MinimalPersistence} */
  #persistence;

  /**
   * @private
   * @type {object}
   * @description Classe de log personalizadas para diferentes níveis de log.
   */
  _logger;

  /**
   * Cria uma instância de SimplePersistentStore.
   * @param {string} storageKey - A chave de armazenamento para a persistência.
   */
  constructor(storageKey) {
    this._logger = new Logger('SimplePersistentStore'); // Inicializa uma nova instancia de log.
    this._logger.info('Initialized...');
    this.#persistence = new MinimalPersistence(storageKey);
  }

  /**
   * Define um valor para uma chave, com um TTL (tempo de vida) opcional.
   * Sobrescreve o valor existente se a chave já existir.
   * @param {string} key - A chave para armazenar o valor.
   * @param {*} value - O valor a ser armazenado.
   * @param {number|null} [ttl=null] - O tempo de vida em milissegundos. Se `null`, o item não expira.
   */
  set(key, value, ttl = null) {
    const data = this.#persistence.load() || {};
    const now = Date.now();

    data[key] = {
      value,
      expiresAt: ttl ? now + ttl : null,
      createdAt: now,
    };

    this.#persistence.save(data);
  }

  /**
   * Obtém um valor associado a uma chave.
   * Se o item estiver expirado, ele é removido e `null` é retornado.
   * @param {string} key - A chave do valor a ser recuperado.
   * @returns {*} O valor associado à chave, ou `null` se a chave não for encontrada ou o item tiver expirado.
   */
  get(key) {
    const data = this.#persistence.load();
    if (!data || !data[key]) return null;

    const item = data[key];
    const now = Date.now();

    // Verifica expiração
    if (item.expiresAt && now > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Remove um item específico do armazenamento.
   * @param {string} key - A chave do item a ser removido.
   */
  delete(key) {
    const data = this.#persistence.load();
    if (data && data[key]) {
      delete data[key];
      this.#persistence.save(data);
    }
  }

  /**
   * Lista todas as chaves de itens válidos (não expirados) no armazenamento.
   * @returns {Array<string>} Um array contendo as chaves dos itens válidos.
   */
  keys() {
    const data = this.#persistence.load();
    if (!data) return [];

    const now = Date.now();
    return Object.keys(data).filter((key) => {
      const item = data[key];
      return !item.expiresAt || now <= item.expiresAt;
    });
  }

  /**
   * Limpa e remove todos os itens expirados do armazenamento.
   * @returns {number} A quantidade de itens que foram removidos.
   */
  cleanup() {
    const data = this.#persistence.load();
    if (!data) return 0;

    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of Object.entries(data)) {
      if (item.expiresAt && now > item.expiresAt) {
        delete data[key];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.#persistence.save(data);
    }

    return cleanedCount;
  }

  /**
   * Limpa completamente todos os dados do armazenamento.
   * @returns {void}
   */
  clear() {
    this.#persistence.clear();
  }
}

module.exports = SimplePersistentStore;
