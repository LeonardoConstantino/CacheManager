const Debounce = require('../utils/debounce.js');
const Logger = require('../logger/Logger.js');

// Detecta ambiente de execução
const isNode = typeof window === 'undefined' && typeof global !== 'undefined';
const isBrowser = typeof window !== 'undefined';

/**
 * Replacer function para JSON.stringify que lida com tipos de dados especiais.
 * Suporta serialização de Date, Map e Set.
 * Também escapa propriedades com o nome '_meta' para evitar conflitos internos.
 * @param {string} key - A chave da propriedade sendo serializada.
 * @param {*} value - O valor da propriedade sendo serializada.
 * @returns {*} O valor serializado ou um objeto com metadados para tipos especiais.
 * @license CC0
 */
function stringifyReplacer(key, value) {
  if (value instanceof Date) {
    return { _meta: { type: 'date' }, value: value.toISOString() };
  }
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Map) {
      return {
        _meta: { type: 'map' },
        value: Array.from(value.entries()),
      };
    } else if (value instanceof Set) {
      // bonus feature!
      return {
        _meta: { type: 'set' },
        value: Array.from(value.values()),
      };
    } else if ('_meta' in value) {
      // Escape "_meta" properties
      return {
        ...value,
        _meta: {
          type: 'escaped-meta',
          value: value['_meta'],
        },
      };
    }
  }
  return value;
}

/**
 * Reviver function para JSON.parse que restaura tipos de dados especiais.
 * Suporta desserialização de Date, Map e Set.
 * Também desfaz o escape de propriedades '_meta' serializadas.
 * @param {string} key - A chave da propriedade sendo desserializada.
 * @param {*} value - O valor da propriedade sendo desserializada.
 * @returns {*} O valor desserializado ou um objeto restaurado para tipos especiais.
 */
function parseReviver(key, value) {
  if (typeof value === 'object' && value !== null && '_meta' in value) {
    if (value._meta.type === 'date') {
      return new Date(value.value);
    }
    if ('_meta' in value) {
      if (value._meta.type === 'map') {
        return new Map(value.value);
      } else if (value._meta.type === 'set') {
        return new Set(value.value);
      } else if (value._meta.type === 'escaped-meta') {
        // Un-escape the "_meta" property
        return {
          ...value,
          _meta: value._meta.value,
        };
      } else {
        console.warn('Unexpected meta', value._meta);
      }
    }
  }
  return value;
}

/**
 * @class MinimalPersistence
 * @description Classe de Persistência Mínima.
 * Abstrai as diferenças de armazenamento entre ambientes NodeJS (usando sistema de arquivos)
 * e Navegador (usando localStorage).
 */
class MinimalPersistence {
  /** @type {string} */
  #storageKey;
  /** @type {import('fs') | undefined} */
  #fs;
  /** @type {import('path') | undefined} */
  #path;
  /** @type {string | undefined} */
  #filePath;
  /** @type {function(*): string} */
  #serializeFn;
  /** @type {function(string): *} */
  #deserializeFn;

  #debounce = new Debounce(3000);
  #ignoredSavesCount = 0;
  #lastReportTime = Date.now();
  #reportInterval = 60000; // 1 minuto (ajuste conforme necessário)

  /** @type {Set<string>} */
  #instances = new Set();

  /**
   * @private
   * @type {object}
   * @description Classe de log personalizadas para diferentes níveis de log.
   */
  _logger;

  /**
   * Cria uma instância de MinimalPersistence.
   * @param {string} [storageKey='cache_data'] - A chave sob a qual os dados serão armazenados.
   * @param {object} [options={}] - Opções de configuração.
   * @param {function(*): string} [options.serialize] - Função customizada para serializar dados.
   * @param {function(string): *} [options.deserialize] - Função customizada para desserializar dados.
   */
  constructor(storageKey = 'cache_data', options = {}) {
    this._logger = new Logger('MinimalPersistence'); // Inicializa uma nova instancia de log.
    this._logger.info('Initialized...');
    this._validateInstanceKey(storageKey);
    this.#storageKey = storageKey;

    // Suas funções de replacer e reviver são injetadas aqui
    this.#serializeFn =
      options.serialize ||
      ((value) => JSON.stringify(value, stringifyReplacer));
    this.#deserializeFn =
      options.deserialize || ((text) => JSON.parse(text, parseReviver));

    if (isNode) {
      // Inicialização NodeJS
      this.#fs = require('fs');
      this.#path = require('path');

      // Define o caminho da pasta cache
      const cacheDir = this.#path.join(process.cwd(), '.generated/cache');

      // Verifica se a pasta cache existe, se não existir, cria
      try {
        if (!this.#fs.existsSync(cacheDir)) {
          this.#fs.mkdirSync(cacheDir, { recursive: true });
        }
      } catch (error) {
        // Em caso de erro na criação, usa o diretório atual como fallback
        this._logger.warn(
          `Não foi possível criar/acessar a pasta cache: ${error.message}. Usando diretório atual.`
        );
        this.#filePath = this.#path.join(process.cwd(), `${storageKey}.json`);
        return;
      }

      // Define o caminho do arquivo dentro da pasta cache
      this.#filePath = this.#path.join(cacheDir, `${storageKey}.json`);
    }
  }

  /**
   * Salva dados de forma síncrona.
   * No NodeJS, salva em um arquivo JSON. No navegador, salva no localStorage.
   * @param {Object} data - Os dados a serem salvos.
   * @param {boolean} [ignoreDebounce=false] - Se `true`, ignora o controle de debounce.
   * @returns {boolean} `true` se a operação foi bem-sucedida, `false` caso contrário.
   */
  save(data, ignoreDebounce = false) {
    // const now = Date.now();

    // if (!ignoreDebounce && !this.#debounce.canCall()) {
    //   this.#ignoredSavesCount++;

    //   if (now - this.#lastReportTime >= this.#reportInterval) {
    //     this._logger.debug(
    //       `[Cache::save] Salvamentos ignorados por debounce nos últimos ${
    //         this.#reportInterval / 1000
    //       }s: ${this.#ignoredSavesCount}`
    //     );
    //     this.#lastReportTime = now;
    //     this.#ignoredSavesCount = 0;
    //   }

    //   return false;
    // }

    // if (ignoreDebounce) {
    //   this._logger.warn('⚠️ Salvamento forçado: debounce ignorado');
    // }

    try {
      const serialized = this.#serializeFn(data);

      if (isNode && this.#fs && this.#filePath) {
        const tmpFilePath = `${this.#filePath}.tmp.${process.pid}`;
        let fd = null;
        try {
          // Etapa 1: escreve no arquivo temporário
          this.#fs.writeFileSync(tmpFilePath, serialized, 'utf8');

          // Etapa 2: força a escrita no disco (fsync)
          fd = this.#fs.openSync(tmpFilePath, 'r+');
          this.#fs.fsyncSync(fd);
          this.#fs.closeSync(fd);
          fd = null;

          // Etapa 3: renomeia para substituir o original (atômico)
          this.#fs.renameSync(tmpFilePath, this.#filePath);

          return true;
        } catch (error) {
          console.error('Falha na escrita atômica do cache:', error);
          // Garante que o arquivo temporário seja removido em caso de falha
          try {
            if (fd !== null) {
              this.#fs.closeSync(fd);
            }

            if (this.#fs.existsSync(tmpFilePath)) {
              this.#fs.unlinkSync(tmpFilePath);
            }
          } catch (cleanupError) {
            // Ignora erros na limpeza, o erro principal é mais importante
          }
        }
      }

      if (isBrowser) {
        localStorage.setItem(this.#storageKey, serialized);
        return true;
      }

      return false;
    } catch (error) {
      this._logger.error('Erro ao salvar:', error.message);
      return false;
    }
  }

  /**
   * Carrega dados de forma síncrona.
   * No NodeJS, carrega de um arquivo JSON. No navegador, carrega do localStorage.
   * @returns {Object|null} Os dados carregados, ou `null` se não houver dados ou ocorrer um erro.
   */
  load() {
    try {
      let serialized = null;

      if (isNode && this.#fs && this.#filePath) {
        // Verifica se fs e filePath estão definidos
        if (this.#fs.existsSync(this.#filePath)) {
          serialized = this.#fs.readFileSync(this.#filePath, 'utf8');
        }
      }

      if (isBrowser) {
        serialized = localStorage.getItem(this.#storageKey);
      }

      return serialized ? this.#deserializeFn(serialized) : null; // Usa a função injetada
    } catch (error) {
      this._logger.error('Erro ao carregar:', error.message);
      return null;
    }
  }

  /**
   * Remove os dados persistidos.
   * No NodeJS, deleta o arquivo. No navegador, remove do localStorage.
   * @returns {boolean} `true` se a operação foi bem-sucedida, `false` caso contrário.
   */
  clear() {
    try {
      if (isNode && this.#fs && this.#filePath) {
        // Verifica se fs e filePath estão definidos
        if (this.#fs.existsSync(this.#filePath)) {
          this.#fs.unlinkSync(this.#filePath);
        }
        return true;
      }

      if (isBrowser) {
        localStorage.removeItem(this.#storageKey);
        return true;
      }

      this.#instances.delete(this.#storageKey);

      return false;
    } catch (error) {
      this._logger.error('Erro ao limpar:', error.message);
      return false;
    }
  }

  /**
   * Verifica se existem dados salvos no armazenamento.
   * @returns {boolean} `true` se existem dados persistidos, `false` caso contrário.
   */
  exists() {
    if (isNode && this.#fs && this.#filePath) {
      // Verifica se fs e filePath estão definidos
      return this.#fs.existsSync(this.#filePath);
    }

    if (isBrowser) {
      return localStorage.getItem(this.#storageKey) !== null;
    }

    return false;
  }

  /**
   * @private
   * @description Valida a chave da instância e impede duplicidade.
   * @param {string} key - Chave única para identificar a instância.
   * @throws {Error} Se a chave for inválida ou já estiver em uso.
   */
  _validateInstanceKey(key) {
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('storageKey deve ser uma string não vazia');
    }
    if (this.#instances.has(key)) {
      this._logger.warn(`storageKey "${key}" já está em uso`);
    }
    this.#instances.add(key);
  }
}

module.exports = { MinimalPersistence, stringifyReplacer, parseReviver };
