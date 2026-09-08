# grafos

**Trabalho 1 — Teoria dos Grafos.** Dois *showcases* de BFS/DFS aplicados a
jogos, publicados como site estático.

🔗 **https://nicdolfini-sys.github.io/grafos/**

## Os dois showcases

### 1. Jogo da Velha — DFS
`site/tictactoe.html`

- O jogo é um **grafo de estados**: nó = configuração do tabuleiro, aresta = jogada.
- A sugestão de melhor jogada para você (X) vem de um **minimax por DFS
  recursivo**: `valor = +1` se X vence, `-1` se O vence, `0` empate; X maximiza,
  O minimiza. A casa de maior valor é destacada.
- O grafo ao lado é a árvore/DAG de jogadas percorrida pela DFS, com a **linha
  principal** (a variação ótima a partir da sua sugestão) em destaque.
- **Computador (O)** — regra simples do enunciado: escolhe qualquer casa livre
  desde que a sua jogada seguinte não resulte em vitória; só abre mão disso
  quando toda casa te daria a vitória (inevitável). Se puder vencer na hora,
  vence. O bloqueio de ameaças surge sozinho da regra.

### 2. Eight Puzzle (3×3) — BFS
`site/eightpuzzle.html`

- Seletor com 10 imagens das personagens Sanrio (as mesmas de `Archive/filled/`,
  com o fundo já preenchido na cor original do site). A imagem escolhida vira as
  8 peças do quebra-cabeça.
- Ao escolher a imagem, o puzzle é embaralhado e a **BFS** roda seguindo o
  pseudocódigo dado:

  ```python
  from collections import deque
  def solve(start, goal):
      queue = deque([start]); parent = {start: None}
      while queue:
          state = queue.popleft()
          if state == goal:
              return reconstruct(parent, state)
          for nxt in neighbors(state):
              if nxt not in parent:
                  parent[nxt] = state
                  queue.append(nxt)
  ```

  Estado = string de 9 dígitos (`'8'` = espaço vazio); objetivo = `"012345678"`;
  vizinho = deslizar uma peça para o vazio.
- O **grafo de estados é desenhado em tempo real** enquanto a BFS expande a
  fronteira, e o **caminho mínimo** (`reconstruct`) fica destacado. A próxima
  peça sugerida pisca no tabuleiro. Botões: embaralhar (com slider de
  profundidade), aplicar sugestão, resolver (passo a passo) e trocar imagem.

## Estética

- Fonte **Lora**; paleta `#ffc0fb` / `#ffffff` e texto em cinza grafite.
- Bordas de "janela" com `﹌﹌﹌`, brilhos/lacinhos (`✧ ✦ ♡ ⋆`) ao redor dos
  títulos, `owelcome` na tela inicial.
- O grafo é desenhado em `<canvas>` de forma **grosseira** de propósito — pode
  ficar grande; arraste para mover e use a roda do mouse para dar zoom.

## Estrutura

```
site/
├── index.html            # tela inicial (escolhe o jogo)
├── tictactoe.html
├── eightpuzzle.html
├── styles.css
├── js/
│   ├── graphview.js      # renderizador de grafo em canvas (compartilhado)
│   ├── ui.js             # bordas ﹌ e enfeites
│   ├── tictactoe.js      # DFS / minimax + regra do computador
│   └── eightpuzzle.js    # BFS + animação do grafo
└── img/puzzle/           # imagens das personagens (fundo preenchido)
```

## Deploy (GitHub Pages via GitHub Actions)

Automático a cada push na `main`, pelo workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml):
`configure-pages` (com `enablement: true`) → `upload-pages-artifact` (pasta
`site/`) → `deploy-pages`.

### Rodar localmente

```bash
cd site
python3 -m http.server 8000
# abra http://localhost:8000
```
