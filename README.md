# Busca em grafos aplicada a jogos — BFS e DFS

Trabalho 1 · Teoria dos Grafos · **https://nicdolfini-sys.github.io/grafos/**

Dois jogos, dois algoritmos clássicos de busca:

| Jogo | Algoritmo | O que ele responde |
|---|---|---|
| **Eight Puzzle** (3×3) | **BFS** — busca em largura | *Qual é a menor sequência de movimentos até montar a imagem?* |
| **Jogo da Velha** | **DFS** — busca em profundidade | *Qual é a melhor jogada agora, sabendo como a partida pode terminar?* |

---

## A ideia que sustenta tudo: um jogo é um grafo

Um **grafo** é só um monte de pontos ligados por linhas. Os pontos se chamam
**nós** (ou vértices) e as linhas, **arestas**.

Para transformar um jogo em grafo, basta combinar:

- **um nó = uma situação do jogo** (uma foto do tabuleiro num instante);
- **uma aresta = uma jogada válida** (o que liga uma foto à foto seguinte).

Repare que o grafo **não é o tabuleiro**. O tabuleiro tem 9 casas; o grafo tem
um nó para *cada arrumação possível* dessas 9 casas. É por isso que um jogo
pequeno vira um grafo enorme: o Eight Puzzle tem **181.440 nós**.

Com essa tradução feita, perguntas do jogo viram perguntas de grafo:

> "Como resolvo o quebra-cabeça no menor número de jogadas?"
> vira
> "Qual é o **caminho mais curto** entre o nó de agora e o nó do objetivo?"

E aí entram BFS e DFS.

---

## BFS e DFS são o mesmo algoritmo com um detalhe trocado

Os dois fazem a mesma coisa: saem de um nó, anotam quem já visitaram para não
andar em círculo, e vão visitando vizinhos. A **única** diferença é a ordem em
que a lista de "lugares para visitar" é consumida:

```python
def busca(inicio, usar_pilha=False):
    vistos = {inicio}
    lista  = [inicio]
    while lista:
        atual = lista.pop() if usar_pilha else lista.pop(0)
        #                ↑ DFS: tira do FIM      ↑ BFS: tira do COMEÇO
        for vizinho in vizinhos(atual):
            if vizinho not in vistos:
                vistos.add(vizinho)
                lista.append(vizinho)
```

- **`pop(0)` — tira do começo: é uma FILA.** Quem chegou primeiro é atendido
  primeiro, como fila de banco. → **BFS**
- **`pop()` — tira do fim: é uma PILHA.** Quem chegou por último é atendido
  primeiro, como pilha de pratos. → **DFS**

Essa troca minúscula muda completamente o formato da exploração:

- **BFS se espalha como uma onda.** Joga uma pedra num lago: primeiro molha
  tudo que está a 1 passo, depois tudo a 2 passos, depois a 3. Ele só começa a
  olhar os nós a 5 jogadas de distância depois de já ter olhado *todos* os que
  estão a 4.
- **DFS mergulha até o fundo.** É andar num labirinto sempre em frente,
  entrando cada vez mais fundo, e só voltar quando bate num beco sem saída —
  aí retrocede um passo e tenta a próxima porta.

Cada formato serve para uma coisa, e é exatamente por isso que cada jogo usa um.

---

# Parte 1 — Eight Puzzle com BFS

## Como o quebra-cabeça vira grafo

O tabuleiro é 3×3 com 8 peças e um espaço vazio. Representamos cada situação
como uma string de 9 dígitos, lida da esquerda para a direita, de cima para
baixo, onde `8` é o espaço vazio:

```
 0  1  2
 3  4  5     →  "012345678"   (este é o objetivo: tudo no lugar)
 6  7  ·
```

Uma **jogada** é deslizar uma peça vizinha para o buraco — o que dá na mesma
que trocar o buraco de lugar com essa peça. Logo, os **vizinhos** de um estado
são os estados que se obtêm movendo o buraco para cima, baixo, esquerda ou
direita (quando não sai do tabuleiro):

```python
def neighbors(state):
    """Todos os estados que estão a exatamente um movimento de distância."""
    z = state.index('8')            # onde está o espaço vazio
    lin, col = divmod(z, 3)
    for dlin, dcol in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        l, c = lin + dlin, col + dcol
        if 0 <= l < 3 and 0 <= c < 3:          # não pode sair do tabuleiro
            j = l * 3 + c
            peças = list(state)
            peças[z], peças[j] = peças[j], peças[z]   # troca buraco ↔ peça
            yield ''.join(peças)
```

O número de vizinhos depende de onde o buraco está: **2** se num canto, **3**
numa borda, **4** se no centro. Note que a relação é simétrica — se dá para ir
de A para B, dá para voltar de B para A. Por isso o grafo é **não dirigido**.

## O algoritmo: BFS

```python
from collections import deque

def solve(start, goal):
    queue  = deque([start])       # a FILA de estados a visitar
    parent = {start: None}        # "de qual estado eu cheguei aqui?"
    while queue:
        state = queue.popleft()               # tira da FRENTE da fila
        if state == goal:
            return reconstruct(parent, state) # achou: monta o caminho
        for nxt in neighbors(state):
            if nxt not in parent:             # nunca visto antes
                parent[nxt] = state           # anota quem foi o "pai"
                queue.append(nxt)             # entra no FIM da fila
    return None                               # objetivo inalcançável
```

Três detalhes carregam o algoritmo inteiro:

**1. `deque` + `popleft()` = fila.**
Isso é o que faz a busca crescer em camadas. Todos os estados a 1 movimento
entram na fila antes de qualquer estado a 2 movimentos; como a fila respeita a
ordem de chegada, todos eles também *saem* antes. A busca varre a distância 1
inteira, depois a 2 inteira, e assim por diante.

**2. O dicionário `parent` faz dois trabalhos ao mesmo tempo.**
- É a lista de "já visitados": `if nxt not in parent` impede visitar duas vezes
  o mesmo estado (sem isso o programa andaria em círculo para sempre).
- É o mapa de volta: guarda, para cada estado, de onde viemos. É isso que
  permite reconstruir o caminho no final. Guardar só o pai é suficiente e
  muito mais barato do que guardar o caminho inteiro de cada estado.

**3. Por que o caminho é garantidamente o mais curto.**
Como a onda cresce camada por camada, a **primeira vez** que o objetivo é
alcançado é necessariamente pela camada mais rasa possível. Se existisse um
caminho mais curto, ele estaria numa camada anterior e teria sido encontrado
antes. Essa garantia é a razão de usar BFS aqui — e é justamente o que o DFS
**não** dá: mergulhando fundo, o DFS pode achar o objetivo por um desvio
gigante e nem perceber que havia um atalho.

## Reconstruindo a resposta de trás para frente

Quando a BFS termina, ela não tem o caminho pronto — tem só a "trilha de
migalhas" do `parent`. Aí é só subir do objetivo até o início e inverter:

```python
def reconstruct(parent, state):
    caminho = []
    while state is not None:      # None marca o estado inicial
        caminho.append(state)
        state = parent[state]     # sobe um degrau
    caminho.reverse()             # estava de trás para frente
    return caminho
```

O resultado é a lista de estados do início até o objetivo. **A jogada sugerida
na tela é simplesmente `caminho[1]`** — o próximo passo do caminho ótimo.

## Enumerando o universo inteiro (também com BFS)

O site desenha **um grafo fixo**, com todos os estados, e a cada jogada só
pinta por cima a região que a busca visitou. Para desenhar esse grafo é preciso
antes conhecê-lo — e a forma de descobrir todos os estados é... a mesma BFS,
só que sem alvo: em vez de parar ao achar o objetivo, ela roda até a fila
esvaziar.

```python
def universo(objetivo="012345678"):
    """Descobre TODOS os estados alcançáveis e a distância de cada um."""
    dist = {objetivo: 0}
    fila = deque([objetivo])
    while fila:
        s = fila.popleft()
        for v in neighbors(s):
            if v not in dist:
                dist[v] = dist[s] + 1     # camada seguinte
                fila.append(v)
    return dist
```

Rodando isso a partir do objetivo, o resultado medido é:

- **181.440 estados** e **241.920 arestas**;
- a distância máxima até o objetivo é **31 movimentos** (nenhum embaralhamento
  do mundo exige mais que isso);
- a camada mais populosa é a de distância 24, com **24.047 estados**.

Como a BFS partiu do objetivo, o `dist` de cada estado é exatamente a sua
distância mínima até a solução — e é esse número que define em qual **camada
vertical** o nó é desenhado no gráfico. Aquele formato de pião que aparece na
tela é isso: poucos estados perto do objetivo (topo), um bolo enorme no meio,
e poucos de novo no extremo mais difícil.

## Por que 181.440 e não 362.880?

Com 9 posições há 9! = **362.880** arrumações possíveis. Mas só metade delas é
alcançável — as outras 181.440 formam um universo paralelo, impossível de
atingir por movimentos legais.

O motivo: cada jogada troca o buraco com uma peça. Uma troca sempre **inverte**
a paridade da permutação; ao mesmo tempo, o buraco anda uma casa, o que também
**inverte** a paridade de (linha + coluna) dele. As duas inversões se cancelam,
então a combinação delas nunca muda. Esse valor que se conserva é um
**invariante**, e ele racha o conjunto de arrumações em dois grupos que jamais
se comunicam. Em linguagem de grafos: o grafo tem **duas componentes conexas**,
e a BFS enxerga apenas a que contém o objetivo.

Consequência prática: embaralhar sorteando peças ao acaso pode gerar um
quebra-cabeça **sem solução**. Para evitar isso, o embaralhamento é feito ao
contrário — partindo da imagem montada e dando `n` passos aleatórios:

```python
import random

def embaralhar(objetivo, n):
    s, anterior = objetivo, None
    for _ in range(n):
        opções = [v for v in neighbors(s) if v != anterior]  # não desfaz o passo
        anterior, s = s, random.choice(opções)
    return s
```

Como só andamos por arestas reais, o estado gerado é **sempre solucionável**, e
de quebra sabemos que a solução tem no máximo `n` movimentos.

## Custo

BFS visita cada nó uma vez e cada aresta uma vez: **O(V + E)**. Aqui, com
V = 181.440 e E = 241.920, é trabalho linear e rápido. O que pesa é a
**memória**, porque a fila e o dicionário de visitados podem chegar a guardar o
grafo inteiro — esse é o preço de ter a garantia do caminho mínimo.

---

# Parte 2 — Jogo da Velha com DFS

## Por que aqui a busca é outra

No Eight Puzzle existe um objetivo fixo e a pergunta é *"por onde chego lá
rápido?"*. No jogo da velha não há um alvo a alcançar: a pergunta é *"esta
jogada me leva a um final bom?"* — e um final só se conhece **chegando até
ele**. Como é preciso descer até o fim de cada linha de jogo para saber quem
ganha, o algoritmo natural é o que mergulha: **DFS**.

O grafo é o mesmo tipo de construção: nó = tabuleiro, aresta = uma jogada.
A diferença é que ele é **dirigido** (não dá para desjogar) e sempre desce:
cada aresta acrescenta exatamente uma peça, então em no máximo 9 níveis tudo
acaba. Um grafo assim, sem ciclos, é uma **árvore de jogo** — ou, mais
precisamente aqui, um **DAG** (grafo dirigido acíclico), porque a mesma posição
pode ser alcançada por ordens de jogada diferentes.

## Minimax: DFS que dá nota

DFS puro só percorre. Para *decidir*, ele carrega uma nota de volta na subida.
A regra é dar nota apenas ao que é indiscutível — o fim de jogo:

- **+1** se o X venceu
- **−1** se o O venceu
- **0** se deu velha

E a nota de uma posição no meio do jogo vem dos filhos, com uma lógica bem
humana: **cada um escolhe o que é melhor para si**. O X escolhe o filho de
maior nota (ele quer +1); o O escolhe o de menor (ele quer −1). Daí o nome
**minimax**: um minimiza, o outro maximiza.

```python
from functools import lru_cache

@lru_cache(maxsize=None)              # memoização (explicada logo abaixo)
def valor(b):
    """Nota da posição b, supondo jogo perfeito dos dois lados."""
    v = vencedor(b)
    if v == 'X':  return +1           # ┐
    if v == 'O':  return -1           # ├ casos-base: o jogo acabou,
    if all(b):    return 0            # ┘ a nota é conhecida na hora

    jogador = de_quem_e_a_vez(b)
    notas = []
    for i in range(9):
        if not b[i]:                  # para cada casa livre...
            filho = list(b)
            filho[i] = jogador
            notas.append(valor(tuple(filho)))   # ← DFS: desce até o fim

    return max(notas) if jogador == 'X' else min(notas)
```

Onde está o DFS aqui? Na **recursão**. Cada chamada de `valor` só devolve
resposta depois que todas as chamadas de dentro dela terminaram — ou seja, o
programa desce até uma folha (fim de jogo), volta com a nota, tenta o próximo
irmão, e assim por diante. A pilha de chamadas do Python é literalmente a
pilha do DFS.

Os auxiliares:

```python
LINHAS = [(0,1,2), (3,4,5), (6,7,8),      # horizontais
          (0,3,6), (1,4,7), (2,5,8),      # verticais
          (0,4,8), (2,4,6)]               # diagonais

def vencedor(b):
    for a, c, d in LINHAS:
        if b[a] and b[a] == b[c] == b[d]:
            return b[a]
    return None

def de_quem_e_a_vez(b):
    jogadas = sum(1 for casa in b if casa)
    return 'X' if jogadas % 2 == 0 else 'O'   # X começa
```

Com a nota pronta, sugerir a melhor jogada é testar cada casa livre e ficar
com a de maior nota:

```python
def melhor_jogada_do_X(b):
    melhor, melhor_nota = None, -2
    for i in range(9):
        if not b[i]:
            filho = list(b); filho[i] = 'X'
            nota = valor(tuple(filho))
            if nota > melhor_nota:
                melhor, melhor_nota = i, nota
    return melhor, melhor_nota      # a casa e o que ela promete
```

A nota devolvida junto é o que a tela mostra em palavras: `+1` vira
*"há jogada vencedora para você"*, `0` vira *"melhor caso: empate"*, `−1` vira
*"você está em desvantagem"*. Partindo do tabuleiro vazio a nota é **0** —
prova de que o jogo da velha é empate com jogo perfeito dos dois lados.

## Memoização: de 549.946 para 5.478

Se o DFS descer ingenuamente por todas as ordens de jogada possíveis, ele
visita **549.946 nós** (e existem 255.168 partidas distintas). Só que muita
coisa aí é trabalho repetido: jogar no canto e depois no centro dá exatamente o
mesmo tabuleiro que jogar no centro e depois no canto. Como a nota depende só
de *como o tabuleiro está* — e não do caminho até ele —, calcular de novo é
desperdício.

**Memoizar** é guardar a resposta na primeira vez e reutilizar depois (é o que
o `@lru_cache` faz). Aí a busca deixa de percorrer a árvore de todas as
sequências e passa a percorrer o grafo de **posições distintas**:

| | sem memoização | com memoização |
|---|---|---|
| nós visitados | 549.946 | **5.478** |
| | (árvore de sequências) | (grafo de posições) |

São **100× menos trabalho**, e é o que permite recalcular tudo instantaneamente
a cada jogada. O grafo desenhado no site é justamente esse: **5.478 nós e
16.167 arestas**, montado uma vez e nunca mais reconstruído.

## A linha principal

Saber a melhor jogada é uma coisa; mostrar *por quê* é outra. A **linha
principal** é a continuação em que os dois lados jogam sempre o ótimo — é ela
que aparece destacada em rosa sobre o grafo:

```python
def linha_principal(b):
    caminho = [b]
    while vencedor(b) is None and not all(b):
        jogador = de_quem_e_a_vez(b)
        filhos = []
        for i in range(9):
            if not b[i]:
                f = list(b); f[i] = jogador
                filhos.append(tuple(f))
        # X pega o filho de maior nota; O, o de menor
        b = (max if jogador == 'X' else min)(filhos, key=valor)
        caminho.append(b)
    return caminho
```

## Colorindo a região que ainda importa

A cada jogada, as posições já "para trás" viram impossíveis. O que o minimax
realmente percorre é o conjunto de tabuleiros **ainda alcançáveis** a partir de
agora — e é essa região que o site pinta sobre o grafo fixo. Descobri-la é uma
busca simples a partir do nó atual:

```python
def filhos(b):
    """As posições que podem vir logo depois de b."""
    if vencedor(b) or all(b):
        return                        # fim de jogo: não tem continuação
    jogador = de_quem_e_a_vez(b)
    for i in range(9):
        if not b[i]:
            f = list(b); f[i] = jogador
            yield tuple(f)

def ainda_alcancaveis(b):
    vistos = {b}
    pilha  = [b]
    while pilha:
        atual = pilha.pop()          # PILHA → DFS
        for f in filhos(atual):      # trocar por pop(0) daria BFS,
            if f not in vistos:      # e o resultado seria o mesmo conjunto
                vistos.add(f)
                pilha.append(f)
    return vistos
```

A partir do tabuleiro vazio isso devolve os 5.478 nós — o grafo inteiro, já
que no início nada foi descartado ainda.

Aqui a escolha entre pilha e fila **não muda a resposta** — só a ordem em que
os nós aparecem. Como o objetivo é apenas *marcar* um conjunto (e não medir
distância nem achar caminho), qualquer uma serve. É um bom lembrete de que a
escolha entre BFS e DFS depende da pergunta, não do grafo.

Conforme a partida avança, essa região encolhe: no começo ela cobre o grafo
inteiro; no fim, sobra só um punhado de nós. Visualmente, é a busca "fechando o
cerco" sobre o desfecho.

## Como o computador escolhe (e por que ele não é imbatível)

O adversário **não** usa minimax — de propósito, senão nunca daria para ganhar
dele. Ele segue uma regra de **uma jogada à frente**: *escolher qualquer casa
livre, desde que a sua resposta seguinte não seja uma vitória sua; só abrir mão
disso quando toda casa te daria a vitória (aí é inevitável).*

```python
def jogada_do_computador(b):
    livres = [i for i in range(9) if not b[i]]

    # 1) se dá para vencer agora, vence
    for i in livres:
        t = list(b); t[i] = 'O'
        if vencedor(tuple(t)) == 'O':
            return i

    # 2) casas "seguras": depois delas o X não vence na jogada seguinte
    seguras = []
    for i in livres:
        t = list(b); t[i] = 'O'
        x_vence_na_proxima = any(
            vencedor(tuple(t[:j] + ['X'] + t[j+1:])) == 'X'
            for j in range(9) if not t[j]
        )
        if not x_vence_na_proxima:
            seguras.append(i)

    # 3) qualquer uma das seguras; se nenhuma for, a derrota é inevitável
    return random.choice(seguras or livres)
```

Duas observações interessantes:

- **A defesa aparece sozinha.** Não existe nenhuma linha de código dizendo
  "bloqueie o adversário". Mas se você tem duas em linha e uma casa livre,
  qualquer jogada que *não* seja bloquear deixa `x_vence_na_proxima = True` e é
  descartada no passo 2 — sobra só o bloqueio. O comportamento **emerge** da
  regra.
- **Ele cai em armadilhas de garfo.** Como só enxerga uma jogada à frente, não
  vê você montar uma posição com *duas* ameaças simultâneas: aí ele bloqueia
  uma e perde pela outra. Numa simulação de 5.000 partidas contra um jogador
  aleatório ele venceu 3.453, empatou 1.090 e perdeu 457 — ou seja, é bom o
  bastante para punir descuido. Já contra alguém que segue a sugestão do
  minimax, em 2.000 partidas ele **não venceu nenhuma**: o placar fica sempre
  entre vitória sua e empate.

Essa é, no fundo, a diferença entre os dois lados da tela: **profundidade 1**
(o computador, rápido e míope) contra **profundidade total** (o minimax por
DFS, que olha até o fim da partida).

---

# Resumo comparativo

| | **BFS** (Eight Puzzle) | **DFS** (Jogo da Velha) |
|---|---|---|
| Estrutura | **Fila** — `popleft()` | **Pilha** / recursão — `pop()` |
| Como explora | em camadas, como uma onda | mergulha até o fim e volta |
| Garante caminho mínimo? | **Sim** | Não |
| Boa quando | a resposta está perto e você quer a **mais curta** | é preciso **chegar ao fim** para avaliar |
| Custa memória | muita (guarda a camada inteira) | pouca (guarda só o caminho atual) |
| Aqui responde | "qual a menor sequência até montar?" | "qual jogada leva ao melhor final?" |
| Tamanho do grafo | 181.440 nós · 241.920 arestas | 5.478 nós · 16.167 arestas |

Os dois têm o mesmo custo assintótico, **O(V + E)**: cada nó e cada aresta são
tocados uma vez. O que muda é a *ordem* da visita — e é dessa ordem que saem
todas as diferenças de comportamento acima.
