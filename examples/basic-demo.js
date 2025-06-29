const { createNewCacheManager } = require('../index.js');
const Logger = require('../src/logger/Logger.js');
const {logStyles} = require('../src/utils/log.js');
const {
  logTimer,
  Timer,
} = require('../src/utils/Timers.js')
const {sleep} = require('../src/utils/utils.js');

/**
 * Demo completo para apresentação
 * Mostra todas as funcionalidades principais
 */
async function presentationDemo() {
  console.clear();
  const logger = new Logger('Demo');
  logger.custom('🚀 Iniciando Demo do Sistema de Cache Moderno\n', logStyles.bgBlue);

  // 1. Criação do Manager
  logger.info('1️⃣  Criando Cache Manager...', logStyles.section);
  const manager = createNewCacheManager();

  // 2. Criação de caches diferentes
  logger.info('Criando diferentes tipos de cache:');
  const userCache = manager.createCache('users', 'balanced', { maxSize: 3 });
  const sessionCache = manager.createCache('sessions', 'balanced', {
    persistence: {
        enabled: true,
        storageKey: 'demoSessionStorage',
    },
  });
  const apiCache = manager.createCache('api', 'balanced', { defaultTTL: 3000 });

  // 3. Demonstrar operações básicas
  logger.info('\n2️⃣  Testando operações básicas...', logStyles.section);
  userCache.set('user:1', { name: 'João', email: 'joao@email.com' });
  userCache.set('user:2', { name: 'Maria', email: 'maria@email.com' });
  userCache.set('user:3', { name: 'Pedro', email: 'pedro@email.com' });

  logger.info('Cache Users após inserções:', userCache.getStats());

  // 4. Demonstrar LRU
  logger.info('\n3️⃣  Demonstrando LRU (Least Recently Used)...', logStyles.section);
  logger.info('Acessando user:1 (move para final da LRU)');
  const user1 = userCache.get('user:1');
  logger.info('Encontrado:', user1);

  logger.info('Adicionando user:4 (deve remover user:2 por LRU)');
  userCache.set('user:4', { name: 'Ana', email: 'ana@email.com' });
  logger.info('Chaves restantes:', userCache.keys());

  // 5. Demonstrar TTL
  logger.info('\n4️⃣  Demonstrando TTL (Time To Live)...', logStyles.section);
  apiCache.set('temp:data', { value: 'Dados temporários' }, 2000); // 2 segundos
  logger.info('Dados inseridos com TTL de 2s');

  logger.info('Dados imediatamente após inserção:', apiCache.get('temp:data'));
  await sleep(1000); // Espera 1s
  logger.info('TTL atual ', apiCache.getTTL('temp:data'), (text)=>logStyles.underline(logStyles.cyan(text)));

  await sleep(2500); // Espera 2.5s
  logger.warn(
    'Dados após expiração (2.5s):',
    apiCache.get('temp:data') || 'EXPIRADO ❌'
  );

  // 6. Demonstrar persistência
  logger.info('\n5️⃣  Demonstrando persistência...');
  sessionCache.set('session:abc123', { userId: 1, loginTime: Date.now() });
  sessionCache.set('session:xyz789', { userId: 2, loginTime: Date.now() });
  logger.info('Sessões salvas automaticamente (persistent cache)');

  // 7. Performance benchmark
  logger.info('\n6️⃣  Benchmark de Performance...');
  const perfCache = manager.createCache('performance', 'balanced', { maxSize: 10000 });

  // Benchmark de inserção
  await logTimer(
    () => {
      const key = Math.random().toString(36);
      const value = { data: 'test', timestamp: Date.now() };
      perfCache.set(key, value);
    },
    'Cache Set Operations'
  );

  // Benchmark de leitura
  const keys = perfCache.keys();
  await logTimer(
    () => {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      perfCache.get(randomKey);
    },
    'Cache Get Operations'
  );

  // 8. Estatísticas finais
  logger.custom('\n7️⃣  Estatísticas Finais:', logStyles.magenta);
  const globalStats = manager.getStats();
  logger.info('Estatísticas Globais:', globalStats);

    logger.info(
      'Consumo final de memoria dos caches',
      manager.getConsolidateMemoryStats()
    );

  // 9. Cleanup
  logger.info('\n8️⃣  Limpeza e finalização...');
  manager.destroy();
  logger.info('Todos os caches limpos!');

  logger.custom('\n🎉 Demo concluído com sucesso!', logStyles.highlight);
  logger.custom('📊 Sistema de cache pronto para produção', logStyles.underline);
}



presentationDemo().catch(console.error);
// module.exports = { presentationDemo };
