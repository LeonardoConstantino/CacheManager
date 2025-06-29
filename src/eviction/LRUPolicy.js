/**
 * @typedef {import('../types/cache.types.js').LRUNodeType} LRUNodeType
*/

/**
 * Implementação otimizada de lista duplamente encadeada para sistemas de cache LRU.
 * @module DoublyLinkedList
 */

/**
 * @type {LRUNodeType}
*/
class LRUNode {
  /**
   * @type {string}
   * @description Identificador único do item no cache (string vazia indica nó inválido/sentinela)
   */
  key = ''; // Inicializa com string vazia ao invés de null

  /**
   * @type {*}
   * @description Dados armazenados no nó
   */
  value = null;

  /**
   * @type {LRUNode|null}
   * @description Referência ao nó anterior na lista encadeada
   */
  prev = null;

  /**
   * @type {LRUNode|null}
   * @description Referência ao próximo nó na lista encadeada
   */
  next = null;

  /**
   * Cria uma nova instância de nó para lista duplamente encadeada
   * @param {string|null} key - Identificador do item (usa '' se null)
   * @param {*} value - Valor a ser armazenado no nó
   */
  constructor(key, value) {
    this.key = key || ''; // Usa string vazia como fallback se key for null/undefined
    this.value = value; // Inicializa o valor do nó.
    this.prev = null; // O nó anterior é null por padrão.
    this.next = null; // O próximo nó é null por padrão.
  }
}

/**
 * Implementa lista duplamente encadeada com sentinelas para gerenciamento eficiente de cache LRU
 * @class DoublyLinkedList
 */
class DoublyLinkedList {
  /**
   * @private
   * @type {LRUNode}
   * @description Nó sentinela que marca o início da lista
   */
  head = new LRUNode(null, null);

  /**
   * @private
   * @type {LRUNode}
   * @description Nó sentinela que marca o final da lista
   */
  tail = new LRUNode(null, null);

  /**
   * Cria uma nova lista duplamente encadeada com nós sentinelas
   * @example
   * const list = new DoublyLinkedList();
   * // Estrutura inicial:
   * // head <-> tail
   */
  constructor() {
    this.head = new LRUNode(null, null); // Inicializa o nó sentinela da cabeça.
    this.tail = new LRUNode(null, null); // Inicializa o nó sentinela da cauda.
    this.head.next = this.tail; // Conecta a cabeça à cauda.
    this.tail.prev = this.head; // Conecta a cauda à cabeça.
  }

  /**
   * Adiciona um nó ao início da lista (após o head)
   * @param {LRUNode} node - Nó a ser adicionado
   * @returns {void}
   * @example
   * const node = new LRUNode('a', 1);
   * list.addToHead(node);
   * // Estrutura:
   * // head <-> node <-> tail
   */
  addToHead(node) {
    if (!node) return; // Retorna se o nó for nulo

    // Define o `prev` do novo nó para a cabeça
    node.prev = this.head;

    // Define o `next` do novo nó para o nó que estava após a cabeça
    node.next = this.head.next;

    // Garante que head.next existe antes de acessar
    if (this.head.next) {
      // Atualiza o `prev` do nó que estava após a cabeça para o novo nó
      this.head.next.prev = node;
    }

    // Atualiza o `next` da cabeça para o novo nó
    this.head.next = node;
  }

  /**
   * Remove um nó específico da lista
   * @param {LRUNode} node - Nó a ser removido
   * @returns {void}
   * @example
   * // Lista inicial: head <-> A <-> B <-> tail
   * list.removeNode(B);
   * // Lista resultante: head <-> A <-> tail
   */
  removeNode(node) {
    // Verifica se o nó e suas referências existem antes de tentar removê-lo
    if (!node || !node.prev || !node.next) return;

    node.prev.next = node.next; // Conecta o nó anterior do nó a ser removido ao seu próximo nó.
    node.next.prev = node.prev; // Conecta o nó próximo do nó a ser removido ao seu nó anterior.
  }

  /**
   * Move um nó existente para o início da lista
   * @param {LRUNode} node - Nó a ser movido
   * @returns {void}
   * @example
   * // Lista inicial: head <-> A <-> B <-> tail
   * list.moveToHead(B);
   * // Lista resultante: head <-> B <-> A <-> tail
   */
  moveToHead(node) {
    this.removeNode(node); // Remove o nó de sua posição atual.
    this.addToHead(node); // Adiciona o nó de volta à cabeça.
  }

  /**
   * Remove e retorna o último nó válido da lista (antes do tail)
   * @returns {LRUNode|null} Nó removido ou null se lista vazia
   * @example
   * // Lista: head <-> A <-> B <-> tail
   * const removed = list.removeTail(); // Retorna B
   * // Nova lista: head <-> A <-> tail
   */
  removeTail() {
    const lastNode = this.tail.prev; // Obtém o nó que está antes do sentinela `tail`.

    // Verifica se a lista está vazia ou se lastNode é nulo
    if (!lastNode || lastNode === this.head) return null;

    this.removeNode(lastNode); // Remove o nó menos recentemente usado.
    return lastNode; // Retorna o nó removido.
  }
}

/* 
Operações Básicas:

1. Estrutura Inicial:
   head <-> tail

2. addToHead(nodeA):
   head <-> nodeA <-> tail

3. addToHead(nodeB):
   head <-> nodeB <-> nodeA <-> tail

4. moveToHead(nodeA):
   head <-> nodeA <-> nodeB <-> tail

5. removeTail():
   Remove nodeB → head <-> nodeA <-> tail

6. removeNode(nodeA):
   head <-> tail (lista vazia)
*/

module.exports = {DoublyLinkedList, LRUNode};