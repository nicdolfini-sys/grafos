# grafos

Trabalho 1 — Jogo de Grafos.

## Site / GitHub Pages

O conteúdo estático do site fica em [`site/`](site/). O deploy é feito
automaticamente pelo GitHub Actions a cada push na branch `main`, usando o
workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

### Como funciona

1. `actions/configure-pages` ativa o GitHub Pages no repositório (`enablement: true`).
2. `actions/upload-pages-artifact` empacota a pasta `site/`.
3. `actions/deploy-pages` publica o artefato.

A URL publicada aparece no resumo da execução do workflow (aba **Actions**) e em
**Settings → Pages**. Normalmente:

```
https://nicdolfini-sys.github.io/grafos/
```

### Rodar localmente

```bash
cd site
python3 -m http.server 8000
# abra http://localhost:8000
```

### Pré-requisito (uma vez)

Em **Settings → Pages → Build and deployment**, a *Source* deve ser
**GitHub Actions**. O workflow tenta configurar isso sozinho; se a organização
bloquear a ativação automática, ajuste manualmente.
