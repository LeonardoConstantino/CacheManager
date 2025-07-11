/**
 * @typedef {import('../types/cache.types.js').HeapItem} HeapItem
 */

/**
 * @class MinHeap
 * @description Heap Binário Mínimo para gerenciamento eficiente de expirações de itens de cache.
 * Garante que o item com o menor `expiresAt` (ou seja, o item que expirará mais cedo)
 * esteja sempre acessível no topo do heap.
 */
class MinHeap {
  /**
   * @private
   * @type {HeapItem[]}
   * @description Array que representa a estrutura do heap.
   */
  heap = [];

  /**
   * @private
   * @type {Map<string, number>}
   * @description Mapeamento de chave para índice no heap para remoção eficiente.
   */
  keyToIndex = new Map();

  /**
   * Cria uma instância de um MinHeap vazio.
   */
  constructor() {
    this.heap = [];
    this.keyToIndex = new Map();
  }

  /**
   * Adiciona um novo item ao heap, mantendo a propriedade do heap mínimo.
   * @param {HeapItem} item - O item a ser adicionado ao heap. Deve conter `expiresAt` e `key`.
   * @returns {void}
   */
  push(item) {
    // Se a chave já existe, remove o item antigo primeiro
    if (this.keyToIndex.has(item.key)) {
      this.remove(item.key);
    }
    
    const index = this.heap.length;
    this.heap.push(item); // Adiciona o item ao final do array.
    this.keyToIndex.set(item.key, index); // Mapeia a chave para o índice
    this._bubbleUp(index); // Restaura a propriedade do heap subindo o item.
  }

  /**
   * Remove e retorna o item com o menor `expiresAt` (o item que expira mais cedo) do heap.
   * @returns {?HeapItem} O item com a menor data de expiração, ou `null` se o heap estiver vazio.
   */
  pop() {
    if (this.heap.length === 0) return null; // Se o heap estiver vazio, não há nada para remover.
    if (this.heap.length === 1) {
      const lastItem = this.heap.pop(); // Remove o último item
      if (lastItem) {
        this.keyToIndex.delete(lastItem.key); // Remove do mapeamento
      }
      return lastItem || null; // Retorna o item ou null se undefined
    }

    const min = this.heap[0]; // Guarda o item mínimo (raiz do heap).
    this.keyToIndex.delete(min.key); // Remove do mapeamento
    
    const lastItem = this.heap.pop(); // Remove o último item
    if (lastItem) {
      // Verifica se lastItem não é undefined
      this.heap[0] = lastItem; // Move o último item para a raiz.
      this.keyToIndex.set(lastItem.key, 0); // Atualiza o mapeamento
      this._bubbleDown(0); // Restaura a propriedade do heap descendo o novo item da raiz.
    }
    return min; // Retorna o item que foi o menor.
  }

  /**
   * Retorna o item com o menor `expiresAt` sem removê-lo do heap.
   * @returns {?HeapItem} O item com a menor data de expiração, ou `null` se o heap estiver vazio.
   */
  peek() {
    // Retorna o primeiro elemento se o heap não estiver vazio, caso contrário retorna null.
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Retorna o número de itens atualmente no heap.
   * @returns {number} O tamanho atual do heap.
   */
  size() {
    return this.heap.length; // O tamanho do heap é o tamanho do array interno.
  }

  /**
   * Remove todos os itens do heap, deixando-o vazio.
   * @returns {void}
   */
  clear() {
    this.heap = []; // Reinicia o array do heap.
    this.keyToIndex.clear(); // Limpa o mapeamento
  }

  /**
   * Retorna uma cópia ordenada de todos os itens do heap, e limpa o heap logo em seguida.
   * @returns {HeapItem[]} Array com os itens ordenados por `expiresAt`.
   */
  extractAll() {
    // Clona o heap original superficialmente
    const clone = [...this.heap];
    // Ordena os itens por expiresAt (menor para maior)
    const sorted = clone.sort((a, b) => a.expiresAt - b.expiresAt);

    // Limpa o heap
    this.clear();

    return sorted;
  }

  /**
   * Remove um item específico do heap pela sua chave.
   * @param {string} key - A chave do item a ser removido.
   * @returns {boolean} True se o item foi encontrado e removido, false caso contrário.
   */
  remove(key) {
    // Verifica se a chave existe no mapeamento
    const index = this.keyToIndex.get(key);
    if (index === undefined) {
      return false; // Item não encontrado
    }

    // Remove a chave do mapeamento
    this.keyToIndex.delete(key);

    // Se é o último item, simplesmente remove
    if (index === this.heap.length - 1) {
      this.heap.pop();
      return true;
    }

    // Se é o único item, limpa o heap
    if (this.heap.length === 1) {
      this.heap = [];
      return true;
    }

    // Guarda o item que será removido e o último item
    const removedItem = this.heap[index];
    const lastItem = this.heap.pop();

    // Se lastItem existe, move para a posição do item removido
    if (lastItem) {
      this.heap[index] = lastItem;
      this.keyToIndex.set(lastItem.key, index);

      // Restaura a propriedade do heap
      // Verifica se precisa subir ou descer
      if (index > 0 && this.heap[index].expiresAt < this.heap[Math.floor((index - 1) / 2)].expiresAt) {
        this._bubbleUp(index);
      } else {
        this._bubbleDown(index);
      }
    }

    return true;
  }

  /**
   * @private
   * @description Move um item para cima no heap até que a propriedade do heap seja restaurada.
   * Utilizado após a adição de um novo item.
   * @param {number} index - O índice do item a ser "borbulhado" para cima.
   * @returns {void}
   */
  _bubbleUp(index) {
    // Continua enquanto o índice não for a raiz do heap.
    while (index > 0) {
      // Calcula o índice do pai.
      const parentIndex = Math.floor((index - 1) / 2);
      // Se o pai for menor ou igual ao item atual, a propriedade do heap é mantida.
      if (this.heap[parentIndex].expiresAt <= this.heap[index].expiresAt) break;

      // Atualiza o mapeamento antes da troca
      this.keyToIndex.set(this.heap[parentIndex].key, index);
      this.keyToIndex.set(this.heap[index].key, parentIndex);

      // Troca o item atual com seu pai se o item atual for menor.
      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIndex],
      ];
      index = parentIndex; // Atualiza o índice para o do pai para continuar subindo.
    }
  }

  /**
   * @private
   * @description Move um item para baixo no heap até que a propriedade do heap seja restaurada.
   * Utilizado após a remoção da raiz ou atualização de um item.
   * @param {number} index - O índice do item a ser "borbulhado" para baixo.
   * @returns {void}
   */
  _bubbleDown(index) {
    // Loop infinito que é quebrado quando o item não precisa mais descer.
    while (true) {
      let minIndex = index; // Assume que o item atual é o menor.
      const leftChild = 2 * index + 1; // Calcula o índice do filho esquerdo.
      const rightChild = 2 * index + 2; // Calcula o índice do filho direito.

      // Se o filho esquerdo existe e é menor que o item no minIndex, atualiza minIndex.
      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].expiresAt < this.heap[minIndex].expiresAt
      ) {
        minIndex = leftChild;
      }

      // Se o filho direito existe e é menor que o item no minIndex, atualiza minIndex.
      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].expiresAt < this.heap[minIndex].expiresAt
      ) {
        minIndex = rightChild;
      }

      // Se o item atual ainda é o menor, a propriedade do heap é restaurada.
      if (minIndex === index) break;

      // Atualiza o mapeamento antes da troca
      this.keyToIndex.set(this.heap[index].key, minIndex);
      this.keyToIndex.set(this.heap[minIndex].key, index);

      // Troca o item atual com o menor de seus filhos.
      [this.heap[index], this.heap[minIndex]] = [
        this.heap[minIndex],
        this.heap[index],
      ];
      index = minIndex; // Atualiza o índice para o do filho para continuar descendo.
    }
  }
}

module.exports = MinHeap;

/*
// Exemplos de uso (métodos existentes permanecem inalterados)
const heap = new MinHeap();
heap.push({ key: 'item1', expiresAt: Date.now() + 1000 }); // Adiciona um item
heap.push({ key: 'item2', expiresAt: Date.now() + 2000 }); // Adiciona outro item
heap.remove('item1'); // Remove o item com chave 'item1' - NOVO MÉTODO
heap.pop(); // Remove e retorna o item com a menor data de expiração
heap.peek(); // Retorna o item com a menor data de expiração sem removê-lo
heap.extractAll(); // Retorna uma cópia ordenada de todos os itens e limpa o heap
heap.size(); // Retorna o número de itens atualmente no heap
heap.clear(); // Remove todos os itens do heap, deixando-o vazio
*/