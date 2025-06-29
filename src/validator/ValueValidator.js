/**
 * Classe responsável por validar valores para cache em memória e persistência
 * Oferece validações em múltiplos níveis de performance e segurança
 */
class ValueValidator {
  /**
   * Cria uma instância do ValueValidator
   * @param {Object} [options={}] - Opções de configuração
   * @param {Object} [options.logger=null] - Logger para debug e erro
   * @param {string} [options.defaultLevel='BALANCED'] - Nível padrão de validação
   * @param {Object} [options.customPresets={}] - Presets personalizados
   */
  constructor(options = {}) {
    this._logger = options.logger || null;
    this._defaultLevel = options.defaultLevel || 'BALANCED';
    this._customPresets = options.customPresets || {};

    // Presets para validação em memória
    this._memoryPresets = {
      ULTRA_FAST: {
        skipValidation: false,
        allowNull: true,
        allowUndefined: false,
        maxStringLength: 1000000,
        maxArrayLength: 100000,
        checkCircularRefs: false,
        checkSerializedSize: false,
      },

      BALANCED: {
        skipValidation: false,
        allowNull: true,
        allowUndefined: false,
        maxStringLength: 500000,
        maxArrayLength: 50000,
        maxObjectKeys: 1000,
        checkCircularRefs: false,
        checkSerializedSize: true,
        maxSerializedSize: 100000,
      },

      SECURE: {
        skipValidation: false,
        allowNull: false,
        allowUndefined: false,
        maxStringLength: 100000,
        maxArrayLength: 10000,
        maxObjectKeys: 500,
        checkCircularRefs: true,
        checkSerializedSize: true,
        maxSerializedSize: 50000,
      },
    };

    // Presets para persistência
    this._persistencePresets = {
      SESSION_STORAGE: {
        maxSerializedSize: 1048576, // 1MB
        maxDepth: 16,
        allowBigInt: false,
        validateSerialization: true,
      },

      FILE_STORAGE: {
        maxSerializedSize: 16777216, // 16MB
        maxDepth: 32,
        allowBigInt: true,
        validateSerialization: true,
      },

      CRITICAL_DATA: {
        maxSerializedSize: 1048576, // 1MB
        maxDepth: 8,
        allowBigInt: false,
        validateSerialization: true,
        allowNull: false,
        allowUndefined: false,
      },
    };

    // Mescla presets personalizados
    this._memoryPresets = {
      ...this._memoryPresets,
      ...this._customPresets.memory,
    };
    this._persistencePresets = {
      ...this._persistencePresets,
      ...this._customPresets.persistence,
    };
  }

  /**
   * Validação otimizada para alta performance com segurança básica
   * Foca apenas nas validações essenciais com custo O(1) ou O(k) baixo
   * @param {*} value - O valor a ser validado
   * @param {boolean} [skipValidation=false] - Flag para pular validação
   * @param {Object} [options={}] - Opções de validação lightweight
   * @returns {boolean} True se válido ou pulado
   * @throws {Error} Se inválido
   */
  validateLightweight(value, skipValidation = false, options = {}) {
    // Early return se skip ativo - Custo: O(1)
    if (skipValidation === true) {
      this._log('debug', 'Validação pulada por flag skipValidation');
      return true;
    }

    // Configuração otimizada - Custo: O(1)
    const config = {
      allowNull: options.allowNull !== false,
      allowUndefined: options.allowUndefined === true,
      maxStringLength: options.maxStringLength || 1000000,
      maxArrayLength: options.maxArrayLength || 100000,
      ...options,
    };

    // === VALIDAÇÕES CRÍTICAS O(1) ===

    // 1. Undefined - Custo: O(1)
    if (value === undefined && !config.allowUndefined) {
      throw new Error('Undefined values not allowed');
    }

    // 2. Null - Custo: O(1)
    if (value === null && !config.allowNull) {
      throw new Error('Null values not allowed');
    }

    // 3. Tipos problemáticos - Custo: O(1)
    const valueType = typeof value;

    if (valueType === 'function') {
      throw new Error('Functions cannot be cached');
    }

    if (valueType === 'symbol') {
      throw new Error('Symbols cannot be cached');
    }

    // 4. Numbers especiais - Custo: O(1)
    if (valueType === 'number') {
      if (Number.isNaN(value)) {
        throw new Error('NaN values not allowed');
      }
      if (!Number.isFinite(value)) {
        throw new Error('Infinite values not allowed');
      }
    }

    // 5. String length - Custo: O(1)
    if (valueType === 'string' && value.length > config.maxStringLength) {
      throw new Error(
        `String too long: ${value.length} > ${config.maxStringLength}`
      );
    }

    // 6. Array length - Custo: O(1)
    if (Array.isArray(value) && value.length > config.maxArrayLength) {
      throw new Error(
        `Array too long: ${value.length} > ${config.maxArrayLength}`
      );
    }

    // 7. Referências circulares - Custo: O(n) - APENAS se habilitado
    if (
      config.checkCircularRefs === true &&
      value !== null &&
      valueType === 'object'
    ) {
      try {
        JSON.stringify(value);
      } catch (error) {
        if (error.message.includes('circular')) {
          throw new Error('Circular references detected');
        }
      }
    }

    return true;
  }

  /**
   * Validação de nível médio - balance entre performance e segurança
   * @param {*} value - Valor a validar
   * @param {boolean} [skipValidation=false] - Skip flag
   * @param {Object} [options={}] - Opções
   * @returns {boolean} True se válido
   */
  validateBalanced(value, skipValidation = false, options = {}) {
    // Executa validação lightweight primeiro
    this.validateLightweight(value, skipValidation, options);

    if (skipValidation === true) return true;

    const config = {
      maxObjectKeys: options.maxObjectKeys || 1000,
      maxSerializedSize: options.maxSerializedSize || 100000,
      ...options,
    };

    // Validações adicionais para objetos
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Limite de propriedades - Custo: O(1) para objetos simples
      const keys = Object.keys(value);
      if (keys.length > config.maxObjectKeys) {
        throw new Error(
          `Object has too many keys: ${keys.length} > ${config.maxObjectKeys}`
        );
      }

      // Verificação de tamanho serializado - Custo: O(n) limitado
      if (config.checkSerializedSize === true) {
        try {
          const serialized = JSON.stringify(value);
          if (serialized.length > config.maxSerializedSize) {
            throw new Error(
              `Serialized size too large: ${serialized.length} > ${config.maxSerializedSize}`
            );
          }
        } catch (error) {
          if (error.message.includes('circular')) {
            throw new Error('Circular references detected');
          }
          throw error;
        }
      }
    }

    return true;
  }

  /**
   * Valida valores usando presets pré-definidos
   * @param {*} value - Valor a validar
   * @param {string|null} [level='BALANCED'] - Nível de validação (ULTRA_FAST, BALANCED, SECURE)
   * @param {boolean} [skipValidation=false] - Skip flag
   * @returns {boolean} True se válido
   */
  validateMemory(value, level = null, skipValidation = false) {
    const validationLevel = level || this._defaultLevel;
    const config = this._memoryPresets[validationLevel];

    if (!config) {
      throw new Error(`Unknown validation level: ${validationLevel}`);
    }

    if (validationLevel === 'ULTRA_FAST') {
      return this.validateLightweight(value, skipValidation, config);
    } else {
      return this.validateBalanced(value, skipValidation, config);
    }
  }

  /**
   * Valida valores que serão persistidos com serialização personalizada
   * @param {*} value - O valor a ser validado para persistência
   * @param {boolean} [skipValidation=false] - Flag para pular validação
   * @param {Object|string} [options={}] - Opções ou nome do preset
   * @returns {Object} Objeto com isValid, serializedValue e metadata
   * @throws {Error} Se o valor for inválido para persistência
   */
  validatePersistence(value, skipValidation = false, options = {}) {
    // Early return se skip ativo
    if (skipValidation === true) {
      return {
        isValid: true,
        serializedValue: null,
        metadata: { skipped: true },
      };
    }

    // Resolve configuração (pode ser string do preset ou objeto)
    let config;
    if (typeof options === 'string') {
      config = this._persistencePresets[options];
      if (!config) {
        throw new Error(`Unknown persistence preset: ${options}`);
      }
    } else {
      config = {
        maxSerializedSize: options.maxSerializedSize || 5242880, // 5MB
        maxDepth: options.maxDepth || 32,
        allowBigInt: options.allowBigInt === true,
        validateSerialization: options.validateSerialization !== false,
        allowNull: options.allowNull !== false,
        allowUndefined: options.allowUndefined === true,
        ...options,
      };
    }

    // Primeiro executa validações básicas
    this.validateLightweight(value, false, {
      allowNull: config.allowNull,
      allowUndefined: config.allowUndefined,
      maxStringLength: config.maxSerializedSize / 4,
      maxArrayLength: 1000000,
    });


    /**
     * Objeto de metadados para rastreamento de informações sobre o valor sendo validado
     * @type {Object} 
     * @property {string} originalType - Tipo original do valor antes da validação
     * @property {boolean} hasComplexTypes - Indica se o valor contém tipos complexos
     * @property {number} estimatedSize - Tamanho estimado do valor em bytes
     * @property {number} depth - Profundidade de aninhamento do valor
     * @property {Array} complexTypes - Lista de tipos complexos encontrados no valor
     */
    const metadata = {
      originalType: typeof value,
      hasComplexTypes: false,
      estimatedSize: 0,
      depth: 0,
      complexTypes: [],
    };

    try {
      // BigInt validation
      if (typeof value === 'bigint') {
        if (!config.allowBigInt) {
          throw new Error('BigInt values not allowed for persistence');
        }
        metadata.complexTypes.push('bigint');
      }

      // Análise de profundidade e tipos complexos
      const depthAnalysis = this._analyzeValueDepth(value, config.maxDepth);
      metadata.depth = depthAnalysis.maxDepth;
      metadata.hasComplexTypes = depthAnalysis.hasComplexTypes;
      metadata.complexTypes = [
        ...metadata.complexTypes,
        ...depthAnalysis.complexTypes,
      ];

      if (depthAnalysis.maxDepth > config.maxDepth) {
        throw new Error(
          `Value nesting too deep: ${depthAnalysis.maxDepth} > ${config.maxDepth}`
        );
      }

      // Serialização personalizada
      let serializedValue;
      let serializationTime;

      const startTime = this._getPerformanceNow();
      try {
        serializedValue = this._customSerialize(value);
      } catch (error) {
        throw new Error(`Serialization failed: ${error.message}`);
      }
      serializationTime = this._getPerformanceNow() - startTime;

      // Validação de tamanho serializado
      const serializedSize = new TextEncoder().encode(serializedValue).length;
      metadata.estimatedSize = serializedSize;

      if (serializedSize > config.maxSerializedSize) {
        throw new Error(
          `Serialized value too large: ${serializedSize} bytes > ${config.maxSerializedSize} bytes`
        );
      }

      // Teste de round-trip
      if (config.validateSerialization) {
        const deserializationTime = this._getPerformanceNow();
        let deserializedValue;

        try {
          deserializedValue = this._customDeserialize(serializedValue);
        } catch (error) {
          throw new Error(`Deserialization failed: ${error.message}`);
        }

        if (!this._deepEquals(value, deserializedValue)) {
          throw new Error(
            'Value integrity lost during serialization round-trip'
          );
        }

        metadata.deserializationTime =
          this._getPerformanceNow() - deserializationTime;
      }

      metadata.serializationTime = serializationTime;
      metadata.serializedSize = serializedSize;

      this._log(
        'debug',
        `Value validated for persistence - Size: ${serializedSize} bytes, Depth: ${
          metadata.depth
        }, Complex types: [${metadata.complexTypes.join(', ')}]`
      );

      return {
        isValid: true,
        serializedValue,
        metadata,
      };
    } catch (error) {
      this._log('error', `Persistence validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém os presets disponíveis
   * @returns {Object} Objeto com presets de memória e persistência
   */
  getPresets() {
    return {
      memory: { ...this._memoryPresets },
      persistence: { ...this._persistencePresets },
    };
  }

  /**
   * Adiciona ou atualiza um preset personalizado
   * @param {string} type - Tipo do preset ('memory' ou 'persistence')
   * @param {string} name - Nome do preset
   * @param {Object} config - Configuração do preset
   */
  addPreset(type, name, config) {
    if (type === 'memory') {
      this._memoryPresets[name] = config;
    } else if (type === 'persistence') {
      this._persistencePresets[name] = config;
    } else {
      throw new Error(
        `Invalid preset type: ${type}. Use 'memory' or 'persistence'`
      );
    }
  }

  // === MÉTODOS PRIVADOS ===

  /**
   * Analisa a profundidade e tipos complexos de um valor
   * @param {*} value - Valor a analisar
   * @param {number} maxDepth - Profundidade máxima permitida
   * @returns {Object} Análise de profundidade e tipos
   * @private
   */
  _analyzeValueDepth(value, maxDepth) {
    /**
     * Enumeração de tipos complexos usados na análise de profundidade de valores
     * @readonly
     * @enum {string}
     * @description Define constantes para identificação de tipos complexos como Date, Map e Set
     */
    const enumTipes = Object.freeze({
      DATE: 'Date',
      MAP: 'Map',
      SET: 'Set',
    })
    
    /**
     * Objeto de análise para rastrear informações de profundidade e tipos complexos durante a validação de valor
     * @type {Object} 
     * @property {number} maxDepth - Profundidade máxima alcançada durante a análise
     * @property {boolean} hasComplexTypes - Indica se tipos complexos foram encontrados
     * @property {Array<string>} complexTypes - Lista de tipos complexos detectados (como Date, Map, Set)
     */
    const analysis = {
      maxDepth: 0,
      hasComplexTypes: false,
      complexTypes: [],
    };

    const visited = new WeakSet();

    const analyzeRecursive = (val, currentDepth) => {
      if (currentDepth > maxDepth) {
        throw new Error(`Maximum depth exceeded: ${currentDepth}`);
      }

      analysis.maxDepth = Math.max(analysis.maxDepth, currentDepth);

      if (val === null || typeof val !== 'object') {
        return;
      }

      if (visited.has(val)) {
        throw new Error('Circular reference detected during depth analysis');
      }
      visited.add(val);

      // Identifica tipos complexos
      if (val instanceof Date) {
        analysis.hasComplexTypes = true;
        if (!analysis.complexTypes.includes(enumTipes.DATE)) {
          analysis.complexTypes.push(enumTipes.DATE);
        }
      } else if (val instanceof Map) {
        analysis.hasComplexTypes = true;
        if (!analysis.complexTypes.includes(enumTipes.MAP)) {
          analysis.complexTypes.push(enumTipes.MAP);
        }
        for (const [key, value] of val) {
          analyzeRecursive(key, currentDepth + 1);
          analyzeRecursive(value, currentDepth + 1);
        }
      } else if (val instanceof Set) {
        analysis.hasComplexTypes = true;
        if (!analysis.complexTypes.includes(enumTipes.SET)) {
          analysis.complexTypes.push(enumTipes.SET);
        }
        for (const item of val) {
          analyzeRecursive(item, currentDepth + 1);
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          analyzeRecursive(item, currentDepth + 1);
        }
      } else {
        for (const key in val) {
          if (val.hasOwnProperty(key)) {
            analyzeRecursive(val[key], currentDepth + 1);
          }
        }
      }

      visited.delete(val);
    };

    analyzeRecursive(value, 0);
    return analysis;
  }

  /**
   * Serialização personalizada que suporta Date, Map, Set, BigInt
   * @param {*} value - Valor a ser serializado
   * @returns {string} String serializada
   * @private
   */
  _customSerialize(value) {
    const replacer = (key, val) => {
      if (val instanceof Date) {
        return { __type: 'Date', __value: val.toISOString() };
      }
      if (val instanceof Map) {
        return { __type: 'Map', __value: Array.from(val.entries()) };
      }
      if (val instanceof Set) {
        return { __type: 'Set', __value: Array.from(val) };
      }
      if (typeof val === 'bigint') {
        return { __type: 'BigInt', __value: val.toString() };
      }
      if (val === undefined) {
        return { __type: 'undefined', __value: null };
      }
      return val;
    };

    return JSON.stringify(value, replacer);
  }

  /**
   * Deserialização personalizada
   * @param {string} serializedValue - String serializada
   * @returns {*} Valor deserializado
   * @private
   */
  _customDeserialize(serializedValue) {
    const reviver = (key, val) => {
      if (val && typeof val === 'object' && val.__type) {
        switch (val.__type) {
          case 'Date':
            return new Date(val.__value);
          case 'Map':
            return new Map(val.__value);
          case 'Set':
            return new Set(val.__value);
          case 'BigInt':
            return BigInt(val.__value);
          case 'undefined':
            return undefined;
        }
      }
      return val;
    };

    return JSON.parse(serializedValue, reviver);
  }

  /**
   * Compara dois valores profundamente
   * @param {*} a - Primeiro valor
   * @param {*} b - Segundo valor
   * @returns {boolean} True se são iguais
   * @private
   */
  _deepEquals(a, b) {
    if (a === b) return true;

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !this._deepEquals(value, b.get(key))) {
          return false;
        }
      }
      return true;
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const value of a) {
        if (!Array.from(b).some((bValue) => this._deepEquals(value, bValue))) {
          return false;
        }
      }
      return true;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, index) => this._deepEquals(val, b[index]));
    }

    if (
      typeof a === 'object' &&
      typeof b === 'object' &&
      a !== null &&
      b !== null
    ) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(
        (key) => keysB.includes(key) && this._deepEquals(a[key], b[key])
      );
    }

    return false;
  }

  /**
   * Helper para logging
   * @param {string} level - Nível do log
   * @param {string} message - Mensagem
   * @private
   */
  _log(level, message) {
    if (this._logger && typeof this._logger[level] === 'function') {
      this._logger[level](message);
    }
  }

  /**
   * Helper para performance timing
   * @returns {number} Timestamp atual
   * @private
   */
  _getPerformanceNow() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

// Exemplo de uso da classe
/*
// Criação do validator
const validator = new ValueValidator({
  logger: console,
  defaultLevel: 'BALANCED'
});

// Validação para cache em memória
try {
  validator.validateMemory(someValue, 'ULTRA_FAST');
  console.log('Valor válido para cache');
} catch (error) {
  console.error('Valor inválido:', error.message);
}

// Validação para persistência
try {
  const result = validator.validatePersistence(complexValue, false, 'FILE_STORAGE');
  console.log('Valor serializado:', result.serializedValue);
  console.log('Metadata:', result.metadata);
} catch (error) {
  console.error('Falha na persistência:', error.message);
}

// Adicionando preset personalizado
validator.addPreset('memory', 'CUSTOM_FAST', {
  allowNull: false,
  maxStringLength: 50000,
  checkCircularRefs: false
});
*/

export default ValueValidator;
