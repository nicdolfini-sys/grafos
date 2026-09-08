# Busca em grafos aplicada a jogos — BFS e DFS

Trabalho 1 · Teoria dos Grafos · **https://nicdolfini-sys.github.io/grafos/**

| Jogo | Algoritmo | Pergunta que ele responde |
|---|---|---|
| **Eight Puzzle** (3×3) | **BFS** — busca em largura | Qual a **menor** sequência de movimentos até montar a imagem? |
| **Jogo da Velha** | **DFS** — busca em profundidade | Qual jogada leva ao melhor final possível? |

---

## Um jogo é um grafo

Um **grafo** é um conjunto de pontos (**nós**) ligados por linhas (**arestas**).
Para ver um jogo como grafo:

- **nó** = uma situação do jogo (o tabuleiro num instante);
- **aresta** = uma jogada que liga uma situação à seguinte.

O grafo não é o tabuleiro: há um nó para *cada configuração possível* das peças.
Assim, "resolver o quebra-cabeça em menos jogadas" vira "achar o **caminho mais
curto** entre dois nós", e "escolher a melhor jogada" vira "**percorrer** os nós
que podem vir a seguir".

---

## BFS e DFS: o mesmo algoritmo, uma troca

Ambos partem de um nó, marcam quem já foi visitado (para não repetir) e vão
alcançando vizinhos. A única diferença é **em que ordem** os nós pendentes são
processados:

```
BFS(inicio):
    visitados = {inicio}
    fila = [inicio]                     # FILA: primeiro a entrar, primeiro a sair
    enquanto fila não vazia:
        u = fila.remove_do_início()
        para cada vizinho v de u:
            se v não está em visitados:
                visitados.add(v)
                fila.adiciona_no_fim(v)
```

```
DFS(inicio):
    visitados = {inicio}
    pilha = [inicio]                    # PILHA: último a entrar, primeiro a sair
    enquanto pilha não vazia:
        u = pilha.remove_do_topo()
        para cada vizinho v de u:
            se v não está em visitados:
                visitados.add(v)
                pilha.adiciona_no_topo(v)
```

Troque a **fila** por uma **pilha** e o comportamento muda por completo:

- **BFS espalha em ondas.** Visita todos os nós a 1 passo, depois todos a 2,
  depois a 3... Consequência: a **primeira vez** que chega a um nó é sempre pelo
  caminho mais curto.
- **DFS mergulha.** Desce por um ramo até o fim, e só então volta e tenta o
  próximo. Bom quando é preciso chegar às folhas (os finais de jogo) para
  avaliar alguma coisa.

Os dois visitam cada nó e cada aresta uma vez: custo **O(V + E)**.

---

## Eight Puzzle — BFS

**Grafo.** Cada nó é uma disposição das 8 peças e do espaço vazio. Uma jogada
desliza uma peça para o vazio; portanto os vizinhos de um estado são os que se
obtêm movendo o vazio para cima, baixo, esquerda ou direita.

**Por que BFS.** Existe um estado-objetivo (imagem montada) e queremos o menor
número de jogadas até ele — ou seja, o caminho mais curto. Como a BFS alcança
cada nó pela primeira vez já pelo caminho mínimo, a primeira vez que o objetivo
sai da fila, temos a resposta ótima.

```
BFS_menor_caminho(inicio, objetivo):
    fila = [inicio]
    veio_de = {inicio: nenhum}              # de onde cheguei a cada nó
    enquanto fila não vazia:
        estado = fila.remove_do_início()
        se estado == objetivo:
            retorna reconstruir(veio_de, objetivo)
        para cada vizinho v de estado:
            se v não está em veio_de:
                veio_de[v] = estado
                fila.adiciona_no_fim(v)

reconstruir(veio_de, no):                   # sobe do objetivo até o início
    caminho = []
    enquanto no != nenhum:
        caminho.insere_no_começo(no)
        no = veio_de[no]
    retorna caminho
```

O dicionário `veio_de` acumula duas funções: serve de conjunto de visitados
(`v não está em veio_de`) e guarda o "pai" de cada nó, o que permite refazer o
caminho de trás para frente no final. A jogada sugerida na tela é o segundo
elemento desse caminho.

O mesmo mecanismo, sem alvo (rodando até a fila esvaziar), enumera **todo** o
grafo — os 181.440 estados solúveis e 241.920 arestas que a página desenha uma
única vez e sobre os quais só recolore a busca a cada jogada.

---

## Jogo da Velha — DFS

**Grafo.** Nó é um tabuleiro; aresta é uma jogada. Cada jogada acrescenta uma
peça, então o grafo só "desce": em no máximo 9 níveis todo ramo termina em
vitória, derrota ou velha. É uma **árvore de jogo**.

**Por que DFS.** Não há um nó-alvo a alcançar; a qualidade de uma jogada só se
conhece **chegando aos finais** que ela permite. DFS é a forma natural de fazer
isso: desce por um ramo até um fim de jogo, anota o resultado, volta e tenta o
próximo. A recursão é a própria pilha do DFS.

```
DFS_avalia(no):                            # nota da posição, com jogo perfeito
    se no é fim de jogo:
        retorna +1 se X venceu, -1 se O venceu, 0 se velha
    notas = [DFS_avalia(filho) para cada filho de no]
    se é a vez de X:  retorna max(notas)   # X quer a maior nota
    senão:            retorna min(notas)   # O quer a menor
```

Isso é a busca em profundidade carregando um valor na volta: cada nó recebe a
nota do melhor final atingível a partir dele, supondo que **cada jogador
escolhe o que lhe é melhor** (X maximiza, O minimiza). A jogada sugerida é a
que leva ao filho de maior nota. Partindo do tabuleiro vazio a nota é **0** —
com jogo perfeito, jogo da velha sempre empata.

Como a mesma posição é alcançada por ordens de jogada diferentes, guardar a
nota já calculada de cada posição (memoização) faz a DFS percorrer **posições
distintas** em vez de sequências: **5.478 nós** em vez de 549.946. É esse grafo
que a página desenha.

*(O computador adversário não usa essa avaliação — joga por uma regra simples
de uma jogada à frente, de propósito, para ser vencível.)*

---

## BFS × DFS

| | **BFS** | **DFS** |
|---|---|---|
| Estrutura | fila (FIFO) | pilha / recursão (LIFO) |
| Exploração | em ondas, por distância | mergulha num ramo até o fim |
| Garante caminho mínimo | **sim** | não |
| Memória | alta (guarda a fronteira inteira) | baixa (só o ramo atual) |
| Uso aqui | menor solução do puzzle | avaliar finais do jogo da velha |

Mesmo custo assintótico, **O(V + E)**. O que muda é a ordem de visita — e é dela
que vêm todas as diferenças.
