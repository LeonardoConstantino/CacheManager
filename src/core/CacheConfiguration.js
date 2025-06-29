/**
 * @typedef {import('../types/cache.types.js').CacheProfiles} CacheProfiles
 * @typedef {import('../types/cache.types.js').CacheConfigOptions} CacheConfigOptions
 */

const {freezeOptions} = require('./Cache.js');

/**
 * @class CacheConfiguration
 * @description Classe utilitária para gerenciar perfis de configuração de cache predefinidos.
 * Permite definir configurações comuns para diferentes tipos de caches e carregá-las facilmente.
 */
class CacheConfiguration {
  /**
   * @static
   * @type {CacheProfiles}
   * @description Objeto estático que contém os perfis de configuração de cache predefinidos.
   */
  static profiles = Object.freeze({
    'memory-optimized': {
      defaultTTL: 3600,
      enableLRU: true,
      enableAutoCleanup: true,
      enableWeakOptimization: true,
      maxSize: 100,
      cleanupFrequency: 10000,
      freezeOption: freezeOptions.DEEP,
      persistence: {
        enabled: false,
        storageKey: null,
        autoSaveInterval: null,
      },
    },
    'performance-optimized': {
      defaultTTL: 3600,
      enableLRU: false,
      enableAutoCleanup: false,
      enableWeakOptimization: false,
      maxSize: 10000,
      cleanupFrequency: 60000,
      freezeOption: freezeOptions.SHALLOW,
      persistence: {
        enabled: false,
        storageKey: null,
        autoSaveInterval: null,
      },
    },
    balanced: {
      defaultTTL: 3600, // TTL padrão de 1 hora
      enableLRU: true, // Ativar LRU (Least Recently Used)
      enableAutoCleanup: true, // Ativar limpeza automática
      enableWeakOptimization: true, // Ativar otimização com WeakMap()
      maxSize: 1000, // Tamanho máximo do cache
      cleanupFrequency: 30000, // Frequência de limpeza automática
      freezeOption: freezeOptions.DEEP, // Opção de congelamento
      persistence: { // Configurações de persistência
        enabled: false, // Desabilitar persistência
        storageKey: null, // Chave de armazenamento
        autoSaveInterval: null, // Intervalo de salvamento automático
      },
    },
    persistent: {
      defaultTTL: 3600,
      enableLRU: true,
      enableAutoCleanup: true,
      enableWeakOptimization: true,
      maxSize: 50,
      cleanupFrequency: 15000,
      freezeOption: freezeOptions.DEEP,
      persistence: {
        enabled: true,
        storageKey: null,
        autoSaveInterval: 10000,
      },
    },
    'persistent-performance': {
      defaultTTL: 3600,
      enableLRU: false,
      enableAutoCleanup: false,
      enableWeakOptimization: false,
      maxSize: 10000,
      cleanupFrequency: 60000,
      freezeOption: freezeOptions.SHALLOW,
      persistence: {
        enabled: true,
        storageKey: 'large_cache_data',
        autoSaveInterval: 10000,
      },
    },
    'memory-optimized-with-persistence': {
      defaultTTL: 3600,
      enableLRU: true,
      enableAutoCleanup: true,
      enableWeakOptimization: true,
      maxSize: 100,
      cleanupFrequency: 10000,
      freezeOption: freezeOptions.DEEP,
      persistence: {
        enabled: true,
        storageKey: 'memory_cache_data',
        autoSaveInterval: 10000,
      },
    },
    'minimal-critical-persistence': {
      defaultTTL: 3600,
      enableLRU: false,
      enableAutoCleanup: false,
      enableWeakOptimization: false,
      maxSize: 100,
      cleanupFrequency: 10000,
      freezeOption: freezeOptions.NONE,
      persistence: {
        enabled: true,
        storageKey: 'critical_cache_data',
        autoSaveInterval: null,
      },
    },
  });

  /**
   * Retorna um objeto de configuração de cache a partir de um perfil predefinido,
   * aplicando sobrescritas opcionais. Retorna um objeto congelado.
   *
   * @param {string} profileName - Nome do perfil predefinido (ex: 'balanced').
   * @param {Object} [overrides={}] - Propriedades que sobrescrevem a configuração base.
   * @returns {CacheConfigOptions} Configuração final de cache (congelada).
   * @throws {Error} Se o perfil especificado não existir.
   */
  static fromProfile(profileName, overrides = {}) {
    const base = this.profiles[profileName];
    if (!base) {
      throw new Error(`Perfil de cache "${profileName}" não encontrado.`);
    }

    // Mescla profunda para garantir que `persistence` não seja sobrescrito inteiro
    const finalConfig = {
      ...base,
      ...(overrides || {}),
      persistence: {
        ...base.persistence,
        ...(overrides.persistence || {}),
      },
    };

    return Object.freeze(finalConfig);
  }
}

module.exports = CacheConfiguration;